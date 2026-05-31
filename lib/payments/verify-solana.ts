import "server-only";

import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import bs58 from "bs58";

import type { Database } from "@/lib/database.types";
import { getSolanaRpcEnvError, serverEnv } from "@/lib/env/server";
import { normalizePaymentAmount } from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodSetupError, type PaymentMethod } from "@/lib/payments/options";
import { assertSolanaMainnetConnection, normalizeSolanaAddress } from "@/lib/solana/network";

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

let solanaConnectionPromise: Promise<Connection> | undefined;

function amountToBaseUnits(amount: string | number, decimals: number) {
  const normalizedAmount = normalizePaymentAmount(amount);
  const [wholePart = "0", decimalPart = ""] = normalizedAmount.split(".");
  const extraDecimals = decimalPart.slice(decimals);

  if (extraDecimals && /[1-9]/.test(extraDecimals)) {
    throw new Error(`Payment amount has more than ${decimals} decimal places.`);
  }

  const paddedDecimal = decimalPart.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(paddedDecimal || "0");
}

function baseUnitsToAmount(amount: bigint, decimals: number) {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function normalizeSignature(signature: string) {
  const normalizedSignature = signature.trim();

  try {
    if (bs58.decode(normalizedSignature).length !== 64) {
      throw new Error("Invalid signature length.");
    }
  } catch {
    throw new Error("Solana transaction signature is invalid.");
  }

  return normalizedSignature;
}

async function getSolanaProvider() {
  const rpcError = getSolanaRpcEnvError();

  if (rpcError) {
    throw new Error(rpcError);
  }

  if (!solanaConnectionPromise) {
    solanaConnectionPromise = (async () => {
      const connection = new Connection(serverEnv.solanaRpcUrl, "confirmed");

      await assertSolanaMainnetConnection(connection);

      return connection;
    })().catch((error) => {
      solanaConnectionPromise = undefined;
      throw error;
    });
  }

  return solanaConnectionPromise;
}

function resolveSolanaPaymentConfig(paymentMethod: string | null | undefined) {
  const setupError = getPaymentMethodSetupError(paymentMethod);

  if (setupError) {
    throw new Error(setupError);
  }

  const config = getPaymentMethodConfig(paymentMethod);

  if (!config || config.network !== "solana" || config.walletProvider !== "phantom") {
    throw new Error("Please use MetaMask for Ethereum payments.");
  }

  return config;
}

function getAccountKeys(transaction: ParsedTransactionWithMeta) {
  return transaction.transaction.message.accountKeys.map((account) => account.pubkey.toBase58());
}

function hasRequiredSigner(transaction: ParsedTransactionWithMeta, expectedSender: string) {
  return transaction.transaction.message.accountKeys.some(
    (account) => account.signer && account.pubkey.toBase58() === expectedSender,
  );
}

function getNativeSolTransferAmount(transaction: ParsedTransactionWithMeta, expectedSender: string, expectedRecipient: string) {
  let transferredLamports = 0n;

  for (const instruction of transaction.transaction.message.instructions) {
    if (!("parsed" in instruction)) {
      continue;
    }

    const parsed = instruction.parsed as
      | {
          type?: string;
          info?: {
            source?: string;
            destination?: string;
            lamports?: number;
          };
        }
      | undefined;

    if (
      parsed?.type === "transfer" &&
      parsed.info?.source &&
      parsed.info?.destination &&
      normalizeSolanaAddress(parsed.info.source) === expectedSender &&
      normalizeSolanaAddress(parsed.info.destination) === expectedRecipient
    ) {
      transferredLamports += BigInt(parsed.info.lamports || 0);
    }
  }

  return transferredLamports;
}

function getTokenBalanceByOwnerOrAccount(params: {
  transaction: ParsedTransactionWithMeta;
  balances: NonNullable<ParsedTransactionWithMeta["meta"]>["preTokenBalances"];
  mintAddress: string;
  ownerAddress: string;
}) {
  const accountKeys = getAccountKeys(params.transaction);

  return (params.balances || [])
    .filter((balance) => balance.mint === params.mintAddress)
    .filter((balance) => {
      if (balance.owner && normalizeSolanaAddress(balance.owner) === params.ownerAddress) {
        return true;
      }

      const accountAddress = accountKeys[balance.accountIndex];

      return accountAddress ? normalizeSolanaAddress(accountAddress) === params.ownerAddress : false;
    })
    .reduce((total, balance) => total + BigInt(balance.uiTokenAmount.amount || "0"), 0n);
}

function getSplTokenTransferAmount(params: {
  transaction: ParsedTransactionWithMeta;
  mintAddress: string;
  expectedSender: string;
  expectedRecipient: string;
}) {
  const preBalances = params.transaction.meta?.preTokenBalances || [];
  const postBalances = params.transaction.meta?.postTokenBalances || [];
  const senderBefore = getTokenBalanceByOwnerOrAccount({
    transaction: params.transaction,
    balances: preBalances,
    mintAddress: params.mintAddress,
    ownerAddress: params.expectedSender,
  });
  const senderAfter = getTokenBalanceByOwnerOrAccount({
    transaction: params.transaction,
    balances: postBalances,
    mintAddress: params.mintAddress,
    ownerAddress: params.expectedSender,
  });
  const recipientBefore = getTokenBalanceByOwnerOrAccount({
    transaction: params.transaction,
    balances: preBalances,
    mintAddress: params.mintAddress,
    ownerAddress: params.expectedRecipient,
  });
  const recipientAfter = getTokenBalanceByOwnerOrAccount({
    transaction: params.transaction,
    balances: postBalances,
    mintAddress: params.mintAddress,
    ownerAddress: params.expectedRecipient,
  });
  const recipientDelta = recipientAfter - recipientBefore;
  const senderDelta = senderBefore - senderAfter;

  if (recipientDelta <= 0n || senderDelta <= 0n) {
    return 0n;
  }

  return recipientDelta < senderDelta ? recipientDelta : senderDelta;
}

async function loadConfirmedMainnetTransaction(connection: Connection, signature: string, expectedSender: string) {
  const [signatureStatus, transaction] = await Promise.all([
    connection.getSignatureStatuses([signature], { searchTransactionHistory: true }),
    connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    }),
  ]);
  const status = signatureStatus.value[0];

  if (!status || (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized")) {
    return {
      transaction: null,
      invalidMessage: "Payment not confirmed yet.",
    };
  }

  if (status.err) {
    return {
      transaction: null,
      invalidMessage: "The Solana transaction did not complete successfully.",
    };
  }

  if (!transaction) {
    return {
      transaction: null,
      invalidMessage: "Payment not confirmed yet.",
    };
  }

  if (!hasRequiredSigner(transaction, expectedSender)) {
    return {
      transaction: null,
      invalidMessage: "This Solana transaction was not signed by the wallet bound to this order.",
    };
  }

  return {
    transaction,
    invalidMessage: null,
  };
}

async function verifySpecificSolanaPayment(input: {
  payment: PaymentRow;
  paymentMethod: PaymentMethod;
  txHash: string;
  walletAddress?: string | null;
  expectedRecipientAddress?: string | null;
}): Promise<VerificationResult> {
  const connection = await getSolanaProvider();
  const config = resolveSolanaPaymentConfig(input.paymentMethod);
  const txHash = normalizeSignature(input.txHash);
  const expectedSender = normalizeSolanaAddress(
    input.walletAddress || input.payment.wallet_address,
    "A valid Solana payer wallet is required to verify this payment.",
  );
  const expectedRecipient = normalizeSolanaAddress(
    input.expectedRecipientAddress || input.payment.recipient_address,
    "Saved Solana recipient wallet is missing or invalid.",
  );
  const expectedAmount = amountToBaseUnits(input.payment.amount_expected, config.decimals);

  logPaymentDebug("verify-solana-fetch", {
    paymentId: input.payment.id,
    txHash,
    connectedWalletAddress: expectedSender,
    expectedRecipientAddress: expectedRecipient,
    amountExpected: input.payment.amount_expected,
    paymentMethod: input.paymentMethod,
    tokenStandard: config.tokenStandard,
    mintAddress: config.mintAddress || null,
  });

  const { transaction, invalidMessage } = await loadConfirmedMainnetTransaction(connection, txHash, expectedSender);

  if (!transaction) {
    return {
      status: "invalid",
      txHash,
      walletAddress: expectedSender,
      message: invalidMessage || "Payment not confirmed yet.",
      observedBlockAt: null,
    };
  }

  const observedBlockAt = transaction.blockTime ? new Date(transaction.blockTime * 1000).toISOString() : null;

  if (transaction.meta?.err) {
    return {
      status: "invalid",
      txHash,
      walletAddress: expectedSender,
      message: "The Solana transaction did not complete successfully.",
      observedBlockAt,
    };
  }

  if (!observedBlockAt) {
    return {
      status: "invalid",
      txHash,
      walletAddress: expectedSender,
      message: "Unable to confirm when this Solana payment was finalized.",
      observedBlockAt,
    };
  }

  const accountKeys = getAccountKeys(transaction);

  if (!accountKeys.includes(new PublicKey(expectedSender).toBase58())) {
    return {
      status: "invalid",
      txHash,
      walletAddress: expectedSender,
      message: "This Solana transaction does not include the wallet bound to this order.",
      observedBlockAt,
    };
  }

  const receivedAmount =
    config.kind === "native"
      ? getNativeSolTransferAmount(transaction, expectedSender, expectedRecipient)
      : getSplTokenTransferAmount({
          transaction,
          expectedSender,
          expectedRecipient,
          mintAddress: normalizeSolanaAddress(config.mintAddress, `The ${config.label} SPL mint is invalid.`),
        });

  if (receivedAmount < expectedAmount) {
    return {
      status: "invalid",
      txHash,
      walletAddress: expectedSender,
      message: `The ${config.label} transaction did not send enough for this order.`,
      observedBlockAt,
    };
  }

  return {
    status: "paid",
    txHash,
    walletAddress: expectedSender,
    amountReceived: baseUnitsToAmount(receivedAmount, config.decimals),
    message: `${config.label} payment confirmed on Solana Mainnet.`,
    observedBlockAt,
  };
}

export function verifySolSolPayment(input: Omit<Parameters<typeof verifySpecificSolanaPayment>[0], "paymentMethod">) {
  return verifySpecificSolanaPayment({ ...input, paymentMethod: "sol_sol" });
}

export function verifySolUsdcPayment(input: Omit<Parameters<typeof verifySpecificSolanaPayment>[0], "paymentMethod">) {
  return verifySpecificSolanaPayment({ ...input, paymentMethod: "sol_usdc" });
}

export function verifySolUsdtPayment(input: Omit<Parameters<typeof verifySpecificSolanaPayment>[0], "paymentMethod">) {
  return verifySpecificSolanaPayment({ ...input, paymentMethod: "sol_usdt" });
}

export async function verifySolanaPayment(input: {
  payment: PaymentRow;
  txHash: string;
  walletAddress?: string | null;
  expectedRecipientAddress?: string | null;
}): Promise<VerificationResult> {
  switch (input.payment.payment_method) {
    case "sol_sol":
      return verifySolSolPayment(input);
    case "sol_usdc":
      return verifySolUsdcPayment(input);
    case "sol_usdt":
      return verifySolUsdtPayment(input);
    default:
      throw new Error("Unsupported token for this chain.");
  }
}
