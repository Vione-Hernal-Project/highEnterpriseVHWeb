import "server-only";

import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress, isAddress, parseUnits } from "ethers";

import type { Database } from "@/lib/database.types";
import { getSepoliaRpcEnvError, serverEnv } from "@/lib/env/server";
import { normalizePaymentAmount } from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodLabel, getPaymentMethodSetupError } from "@/lib/payments/options";
import { ERC20_PAYMENT_ABI } from "@/lib/web3/config";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type VerificationResult =
  | {
      status: "paid";
      amountReceived: string;
      walletAddress: string;
      txHash: string;
      message: string;
    }
  | {
      status: "pending";
      txHash: string;
      walletAddress: string;
      message: string;
    }
  | {
      status: "invalid";
      txHash: string;
      walletAddress: string;
      message: string;
    };

const transferInterface = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

let sepoliaProvider: JsonRpcProvider | undefined;

function getSepoliaProvider() {
  const rpcError = getSepoliaRpcEnvError();

  if (rpcError) {
    throw new Error(rpcError);
  }

  if (!sepoliaProvider) {
    sepoliaProvider = new JsonRpcProvider(serverEnv.sepoliaRpcUrl);
    logPaymentDebug("verify-provider", {
      rpcHost: (() => {
        try {
          return new URL(serverEnv.sepoliaRpcUrl).host;
        } catch {
          return "invalid";
        }
      })(),
    });
  }

  return sepoliaProvider;
}

function normalizeAddress(address: string, fallbackMessage: string) {
  if (!isAddress(address)) {
    throw new Error(fallbackMessage);
  }

  return getAddress(address);
}

export async function verifySepoliaPayment(input: {
  payment: PaymentRow;
  txHash: string;
  walletAddress?: string | null;
  expectedRecipientAddress?: string | null;
  expectedChainId?: number | null;
}): Promise<VerificationResult> {
  const normalizedExpectedAmount = normalizePaymentAmount(input.payment.amount_expected);
  const config = getPaymentMethodConfig(input.payment.payment_method);
  const setupError = getPaymentMethodSetupError(input.payment.payment_method);

  if (!config || setupError) {
    throw new Error(setupError || "Unsupported payment method.");
  }

  const provider = getSepoliaProvider();
  const merchantAddress = normalizeAddress(
    input.expectedRecipientAddress || input.payment.recipient_address || serverEnv.merchantWalletAddress,
    "Merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS in .env.local.",
  );
  const txHash = input.txHash.trim();
  const transaction = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  const submittedWallet = normalizeAddress(
    input.walletAddress || input.payment.wallet_address || transaction?.from || "",
    "A valid wallet address is required to verify this payment.",
  );

  logPaymentDebug("verify-fetch", {
    paymentId: input.payment.id,
    txHash,
    paymentMethod: input.payment.payment_method,
    expectedRecipientAddress: merchantAddress,
    expectedChainId: input.expectedChainId ?? input.payment.chain_id ?? null,
    connectedWalletAddress: submittedWallet,
    amountExpected: normalizedExpectedAmount,
  });

  if (!transaction || !receipt) {
    logPaymentDebug("verify-pending", {
      paymentId: input.payment.id,
      txHash,
      reason: "missing_transaction_or_receipt",
    });

    return {
      status: "pending",
      txHash,
      walletAddress: submittedWallet,
      message: "Transaction submitted. Waiting for Sepolia confirmation.",
    };
  }

  logPaymentDebug("verify-receipt", {
    paymentId: input.payment.id,
    txHash,
    txFrom: transaction.from,
    txTo: transaction.to,
    txValue: transaction.value.toString(),
    txChainId: transaction.chainId ? Number(transaction.chainId) : null,
    receiptStatus: receipt.status,
    blockNumber: receipt.blockNumber,
  });

  if (receipt.status !== 1) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      message: "The MetaMask transaction did not complete successfully on Sepolia.",
    };
  }

  if (config.kind === "native") {
    const expectedAmount = parseUnits(normalizedExpectedAmount, config.decimals);
    const txRecipient = transaction.to ? normalizeAddress(transaction.to, "Transaction recipient is invalid.") : null;

    if (input.expectedChainId && transaction.chainId && Number(transaction.chainId) !== input.expectedChainId) {
      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        message: `This payment was not submitted on the expected Sepolia chain.`,
      };
    }

    if (txRecipient !== merchantAddress) {
      logPaymentDebug("verify-invalid", {
        paymentId: input.payment.id,
        reason: "wrong_recipient",
        expectedRecipientAddress: merchantAddress,
        actualRecipientAddress: txRecipient,
      });

      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        message: `This Sepolia ETH transaction was not sent to the configured merchant wallet.`,
      };
    }

    if ((transaction.value ?? 0n) < expectedAmount) {
      logPaymentDebug("verify-invalid", {
        paymentId: input.payment.id,
        reason: "underpayment",
        amountExpectedRaw: expectedAmount.toString(),
        amountReceivedRaw: (transaction.value ?? 0n).toString(),
      });

      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        message: `The transaction did not send enough ${config.label}. Update the amount and try again.`,
      };
    }

    logPaymentDebug("verify-paid", {
      paymentId: input.payment.id,
      amountExpected: normalizedExpectedAmount,
      amountReceived: formatUnits(transaction.value, config.decimals),
      connectedWalletAddress: submittedWallet,
      recipientAddress: merchantAddress,
      txHash,
    });

    return {
      status: "paid",
      txHash,
      walletAddress: submittedWallet,
      amountReceived: formatUnits(transaction.value, config.decimals),
      message: `${config.label} payment confirmed on Sepolia.`,
    };
  }

  const tokenAddress = normalizeAddress(
    config.tokenAddress || "",
    `${config.label} token address is invalid. Update NEXT_PUBLIC_${config.label}_TOKEN_ADDRESS in .env.local.`,
  );
  const tokenContract = new Contract(tokenAddress, ERC20_PAYMENT_ABI, provider);
  const decimals = Number((await tokenContract.decimals().catch(() => config.decimals)) ?? config.decimals);
  const expectedAmount = parseUnits(normalizedExpectedAmount, decimals);
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const matchingTransfers = receipt.logs
    .filter((log) => log.address.toLowerCase() === normalizedTokenAddress)
    .map((log) => {
      try {
        return transferInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((log) => {
      const from = getAddress(log!.args.from);
      const to = getAddress(log!.args.to);

      return from === submittedWallet && to === merchantAddress;
    });

  if (!matchingTransfers.length) {
    logPaymentDebug("verify-invalid", {
      paymentId: input.payment.id,
      reason: "missing_transfer_log",
      expectedRecipientAddress: merchantAddress,
      connectedWalletAddress: submittedWallet,
      tokenAddress,
    });

    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      message: `No ${getPaymentMethodLabel(input.payment.payment_method)} transfer to the merchant wallet was found in this Sepolia transaction.`,
    };
  }

  const transferredValue = matchingTransfers.reduce((highest, log) => {
    const nextValue = log!.args.value as bigint;

    return nextValue > highest ? nextValue : highest;
  }, 0n);

  if (transferredValue < expectedAmount) {
    logPaymentDebug("verify-invalid", {
      paymentId: input.payment.id,
      reason: "underpayment",
      amountExpectedRaw: expectedAmount.toString(),
      amountReceivedRaw: transferredValue.toString(),
      tokenAddress,
    });

    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      message: `The transaction did not send enough ${config.label}. Update the amount and try again.`,
    };
  }

  logPaymentDebug("verify-paid", {
    paymentId: input.payment.id,
    amountExpected: normalizedExpectedAmount,
    amountReceived: formatUnits(transferredValue, decimals),
    connectedWalletAddress: submittedWallet,
    recipientAddress: merchantAddress,
    txHash,
    tokenAddress,
  });

  return {
    status: "paid",
    txHash,
    walletAddress: submittedWallet,
    amountReceived: formatUnits(transferredValue, decimals),
    message: `${config.label} payment confirmed on Sepolia.`,
  };
}
