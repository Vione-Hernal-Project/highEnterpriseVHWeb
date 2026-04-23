import "server-only";

import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress, isAddress, parseUnits } from "ethers";

import type { Database } from "@/lib/database.types";
import { getEthereumMainnetRpcEnvError, serverEnv } from "@/lib/env/server";
import { normalizePaymentAmount } from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodLabel, getPaymentMethodSetupError } from "@/lib/payments/options";
import { ERC20_PAYMENT_ABI } from "@/lib/web3/config";
import {
  ETHEREUM_MAINNET_CHAIN_ID,
  ETHEREUM_MAINNET_NETWORK_NAME,
  ETHEREUM_MAINNET_RPC_ENV_NAME,
} from "@/lib/web3/network";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type VerificationResult =
  | {
      status: "paid";
      amountReceived: string;
      walletAddress: string;
      txHash: string;
      message: string;
      observedBlockAt: string;
    }
  | {
      status: "pending";
      txHash: string;
      walletAddress: string;
      message: string;
      observedBlockAt: null;
    }
  | {
      status: "invalid";
      txHash: string;
      walletAddress: string;
      message: string;
      observedBlockAt: string | null;
    };

type TransferVerificationResult =
  | {
      status: "paid";
      amountReceived: string;
      walletAddress: string;
      recipientAddress: string;
      txHash: string;
      message: string;
    }
  | {
      status: "pending";
      txHash: string;
      walletAddress: string;
      recipientAddress: string;
      message: string;
    }
  | {
      status: "invalid";
      txHash: string;
      walletAddress: string;
      recipientAddress: string;
      message: string;
    };

const transferInterface = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const PENDING_CONFIRMATION_MESSAGE = `Transaction submitted. Waiting for ${ETHEREUM_MAINNET_NETWORK_NAME} confirmation. If this takes unusually long, check MetaMask for a dropped or replaced transaction.`;

let ethereumMainnetProviderPromise: Promise<JsonRpcProvider> | undefined;

function safeRpcHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

async function getEthereumMainnetProvider() {
  const rpcError = getEthereumMainnetRpcEnvError();

  if (rpcError) {
    throw new Error(rpcError);
  }

  if (!ethereumMainnetProviderPromise) {
    ethereumMainnetProviderPromise = (async () => {
      const provider = new JsonRpcProvider(serverEnv.ethereumMainnetRpcUrl);

      let network;

      try {
        network = await provider.getNetwork();
      } catch {
        throw new Error(
          `Unable to reach the configured Ethereum Mainnet RPC. Check ${ETHEREUM_MAINNET_RPC_ENV_NAME} and try again.`,
        );
      }

      const detectedChainId = Number(network.chainId);

      if (detectedChainId !== ETHEREUM_MAINNET_CHAIN_ID) {
        throw new Error(
          `Configured Ethereum Mainnet RPC is using chain ID ${detectedChainId}. Update ${ETHEREUM_MAINNET_RPC_ENV_NAME} so it points to Ethereum Mainnet (1).`,
        );
      }

      logPaymentDebug("verify-provider", {
        rpcHost: safeRpcHost(serverEnv.ethereumMainnetRpcUrl),
        chainId: detectedChainId,
      });

      return provider;
    })().catch((error) => {
      ethereumMainnetProviderPromise = undefined;
      throw error;
    });
  }

  return ethereumMainnetProviderPromise;
}

async function loadTransactionState(provider: JsonRpcProvider, txHash: string) {
  try {
    const [transaction, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    return {
      transaction,
      receipt,
    };
  } catch {
    throw new Error(
      `Unable to verify this transaction on Ethereum Mainnet right now. Check ${ETHEREUM_MAINNET_RPC_ENV_NAME} and try again.`,
    );
  }
}

async function loadBlockTimestamp(provider: JsonRpcProvider, blockNumber: number | null | undefined) {
  if (!blockNumber) {
    throw new Error("Unable to load the Ethereum Mainnet block for this transaction.");
  }

  const block = await provider.getBlock(blockNumber);

  if (!block) {
    throw new Error("Unable to load the Ethereum Mainnet block for this transaction.");
  }

  return new Date(Number(block.timestamp) * 1000).toISOString();
}

function normalizeAddress(address: string, fallbackMessage: string) {
  if (!isAddress(address)) {
    throw new Error(fallbackMessage);
  }

  return getAddress(address);
}

export async function verifyEthereumMainnetTransfer(input: {
  paymentMethod: string;
  txHash: string;
  walletAddress?: string | null;
  expectedSenderAddress: string;
  expectedRecipientAddress: string;
  expectedAmount: string | number;
  expectedChainId?: number | null;
}): Promise<TransferVerificationResult> {
  const normalizedExpectedAmount = normalizePaymentAmount(input.expectedAmount);
  const config = getPaymentMethodConfig(input.paymentMethod);
  const setupError = getPaymentMethodSetupError(input.paymentMethod);

  if (!config || setupError) {
    throw new Error(setupError || "Unsupported payment method.");
  }

  const provider = await getEthereumMainnetProvider();
  const senderAddress = normalizeAddress(input.expectedSenderAddress, "Merchant wallet address is invalid.");
  const recipientAddress = normalizeAddress(input.expectedRecipientAddress, "Destination wallet address is invalid.");
  const txHash = input.txHash.trim();
  const { transaction, receipt } = await loadTransactionState(provider, txHash);
  const submittedWallet = normalizeAddress(
    input.walletAddress || transaction?.from || "",
    "A valid merchant wallet address is required to verify this cash-out.",
  );

  logPaymentDebug("cash-out-verify-fetch", {
    txHash,
    paymentMethod: input.paymentMethod,
    expectedSenderAddress: senderAddress,
    expectedRecipientAddress: recipientAddress,
    expectedChainId: input.expectedChainId ?? null,
    connectedWalletAddress: submittedWallet,
    amountExpected: normalizedExpectedAmount,
  });

  if (!transaction || !receipt) {
    return {
      status: "pending",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: PENDING_CONFIRMATION_MESSAGE,
    };
  }

  if (receipt.status !== 1) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: "The merchant wallet transaction did not complete successfully on Ethereum Mainnet.",
    };
  }

  if (input.expectedChainId && transaction.chainId && Number(transaction.chainId) !== input.expectedChainId) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: "This cash-out was not submitted on the expected Ethereum Mainnet chain.",
    };
  }

  if (normalizeAddress(transaction.from, "Transaction sender is invalid.") !== senderAddress) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: "This cash-out transaction was not sent from the configured merchant wallet.",
    };
  }

  if (config.kind === "native") {
    const expectedAmount = parseUnits(normalizedExpectedAmount, config.decimals);
    const txRecipient = transaction.to ? normalizeAddress(transaction.to, "Transaction recipient is invalid.") : null;

    if (txRecipient !== recipientAddress) {
      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        recipientAddress,
        message: "This ETH cash-out was not sent to the selected destination wallet.",
      };
    }

    if ((transaction.value ?? 0n) < expectedAmount) {
      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        recipientAddress,
        message: `The cash-out transaction did not send enough ${config.label}.`,
      };
    }

    return {
      status: "paid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      amountReceived: formatUnits(transaction.value, config.decimals),
      message: `${config.label} cash-out confirmed on Ethereum Mainnet.`,
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

      return from === senderAddress && to === recipientAddress;
    });

  if (!matchingTransfers.length) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: `No ${getPaymentMethodLabel(input.paymentMethod)} transfer to the destination wallet was found in this Ethereum Mainnet transaction.`,
    };
  }

  const transferredValue = matchingTransfers.reduce((highest, log) => {
    const nextValue = log!.args.value as bigint;

    return nextValue > highest ? nextValue : highest;
  }, 0n);

  if (transferredValue < expectedAmount) {
    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      recipientAddress,
      message: `The cash-out transaction did not send enough ${config.label}.`,
    };
  }

  return {
    status: "paid",
    txHash,
    walletAddress: submittedWallet,
    recipientAddress,
    amountReceived: formatUnits(transferredValue, decimals),
    message: `${config.label} cash-out confirmed on Ethereum Mainnet.`,
  };
}

export async function verifyEthereumMainnetPayment(input: {
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

  const provider = await getEthereumMainnetProvider();
  const merchantAddress = normalizeAddress(
    input.expectedRecipientAddress || input.payment.recipient_address || serverEnv.merchantWalletAddress,
    "Merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS in .env.local.",
  );
  const txHash = input.txHash.trim();
  const { transaction, receipt } = await loadTransactionState(provider, txHash);
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
      message: PENDING_CONFIRMATION_MESSAGE,
      observedBlockAt: null,
    };
  }

  const observedBlockAt = await loadBlockTimestamp(provider, receipt.blockNumber);

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
      message: "The MetaMask transaction did not complete successfully on Ethereum Mainnet.",
      observedBlockAt,
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
        message: "This payment was not submitted on the expected Ethereum Mainnet chain.",
        observedBlockAt,
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
        message: "This ETH transaction was not sent to the configured merchant wallet.",
        observedBlockAt,
      };
    }

    if (normalizeAddress(transaction.from, "Transaction sender is invalid.") !== submittedWallet) {
      logPaymentDebug("verify-invalid", {
        paymentId: input.payment.id,
        reason: "wrong_sender",
        connectedWalletAddress: submittedWallet,
        actualSenderAddress: transaction.from,
      });

      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        message: "This ETH transaction was not sent from the wallet that was bound to this order.",
        observedBlockAt,
      };
    }

    if ((transaction.value ?? 0n) !== expectedAmount) {
      logPaymentDebug("verify-invalid", {
        paymentId: input.payment.id,
        reason: "amount_mismatch",
        amountExpectedRaw: expectedAmount.toString(),
        amountReceivedRaw: (transaction.value ?? 0n).toString(),
      });

      return {
        status: "invalid",
        txHash,
        walletAddress: submittedWallet,
        message: `The transaction amount did not exactly match the amount required for this order's ${config.label} payment.`,
        observedBlockAt,
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
      message: `${config.label} payment confirmed on Ethereum Mainnet.`,
      observedBlockAt,
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
  const txSenderAddress = normalizeAddress(transaction.from, "Transaction sender is invalid.");

  if (txSenderAddress !== submittedWallet) {
    logPaymentDebug("verify-invalid", {
      paymentId: input.payment.id,
      reason: "wrong_sender",
      connectedWalletAddress: submittedWallet,
      actualSenderAddress: transaction.from,
      tokenAddress,
    });

    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      message: `This ${config.label} transaction was not sent from the wallet that was bound to this order.`,
      observedBlockAt,
    };
  }

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
      message: `No ${getPaymentMethodLabel(input.payment.payment_method)} transfer to the merchant wallet was found in this Ethereum Mainnet transaction.`,
      observedBlockAt,
    };
  }

  const transferredValue = matchingTransfers.reduce((total, log) => {
    const nextValue = log!.args.value as bigint;

    return total + nextValue;
  }, 0n);

  if (transferredValue !== expectedAmount) {
    logPaymentDebug("verify-invalid", {
      paymentId: input.payment.id,
      reason: "amount_mismatch",
      amountExpectedRaw: expectedAmount.toString(),
      amountReceivedRaw: transferredValue.toString(),
      tokenAddress,
    });

    return {
      status: "invalid",
      txHash,
      walletAddress: submittedWallet,
      message: `The transaction amount did not exactly match the amount required for this order's ${config.label} payment.`,
      observedBlockAt,
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
    message: `${config.label} payment confirmed on Ethereum Mainnet.`,
    observedBlockAt,
  };
}
