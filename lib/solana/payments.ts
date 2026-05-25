"use client";

import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { normalizePaymentAmount } from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodSetupError, type PaymentMethod } from "@/lib/payments/options";
import { assertSolanaMainnetConfig, getSolanaConnection, normalizeSolanaAddress } from "@/lib/solana/network";
import { SOLANA_MERCHANT_WALLET_ADDRESS } from "@/lib/web3/config";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey | { toBase58?: () => string; toString: () => string } | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey | { toBase58?: () => string; toString: () => string } }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  on?: (event: "connect" | "disconnect" | "accountChanged", listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: "connect" | "disconnect" | "accountChanged", listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: {
      solana?: SolanaProvider;
    };
  }
}

type SendSolanaPaymentInput = {
  amount: string | number;
  paymentMethod: PaymentMethod;
  recipientAddress?: string | null;
  expectedWalletAddress?: string | null;
};

type SendSolanaPaymentResult = {
  walletAddress: string;
  txHash: string;
};

const PHANTOM_DOWNLOAD_URL = "https://phantom.app/download";
const PHANTOM_MOBILE_BROWSE_URL = "https://phantom.app/ul/browse";

export function isSolanaMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || touchMac;
}

export function getInjectedPhantomProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
}

export function getInjectedSolanaProvider() {
  return getInjectedPhantomProvider();
}

export function hasPhantomWallet() {
  return Boolean(getInjectedPhantomProvider());
}

export function getPhantomInstallUrl() {
  return PHANTOM_DOWNLOAD_URL;
}

export function getPhantomMobileBrowseUrl() {
  if (typeof window === "undefined") {
    return PHANTOM_MOBILE_BROWSE_URL;
  }

  return `${PHANTOM_MOBILE_BROWSE_URL}/${encodeURIComponent(window.location.href)}`;
}

export function openPhantomMobileDeepLink() {
  if (typeof window !== "undefined") {
    window.location.assign(getPhantomMobileBrowseUrl());
  }
}

function amountToBaseUnits(amount: string | number, decimals: number, symbol: string) {
  const normalizedAmount = normalizePaymentAmount(amount);
  const [wholePart = "0", decimalPart = ""] = normalizedAmount.split(".");
  const extraDecimals = decimalPart.slice(decimals);

  if (extraDecimals && /[1-9]/.test(extraDecimals)) {
    throw new Error(`${symbol} supports up to ${decimals} decimal places.`);
  }

  const paddedDecimal = decimalPart.padEnd(decimals, "0").slice(0, decimals);
  const baseUnits = BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(paddedDecimal || "0");

  if (baseUnits <= 0n) {
    throw new Error(`${symbol} payment amount must be greater than zero.`);
  }

  return baseUnits;
}

function getSolanaPublicKeyString(publicKey: PublicKey | { toBase58?: () => string; toString: () => string } | null | undefined) {
  return publicKey?.toString?.() || publicKey?.toBase58?.() || "";
}

function getSolanaPaymentConfig(paymentMethod: PaymentMethod) {
  const setupError = getPaymentMethodSetupError(paymentMethod);

  if (setupError) {
    throw new Error(setupError);
  }

  const config = getPaymentMethodConfig(paymentMethod);

  if (!config || config.network !== "solana" || config.walletProvider !== "phantom") {
    throw new Error("Please use MetaMask for Ethereum payments.");
  }

  assertSolanaMainnetConfig();

  return config;
}

export async function connectSolanaWallet(options?: { forcePrompt?: boolean }) {
  const provider = getInjectedPhantomProvider();

  if (!provider) {
    throw new Error("Phantom wallet was not found. Install or unlock Phantom, then choose Phantom Wallet again.");
  }

  if (options?.forcePrompt && provider.disconnect) {
    await provider.disconnect().catch(() => {
      // Phantom can reject disconnect when already disconnected. Continue to
      // connect so the wallet extension can decide whether approval is needed.
    });
  }

  const connected = provider.publicKey && !options?.forcePrompt ? { publicKey: provider.publicKey } : await provider.connect({ onlyIfTrusted: false });
  const walletAddress = normalizeSolanaAddress(getSolanaPublicKeyString(connected.publicKey), "Connected Solana wallet is invalid.");

  return {
    provider,
    walletAddress,
    publicKey: new PublicKey(walletAddress),
  };
}

export async function disconnectSolanaWallet() {
  const provider = getInjectedPhantomProvider();

  if (provider && "disconnect" in provider && typeof provider.disconnect === "function") {
    await provider.disconnect();
  }
}

export async function validateSolanaWalletCanPay(input: SendSolanaPaymentInput) {
  const config = getSolanaPaymentConfig(input.paymentMethod);
  const wallet = await connectSolanaWallet();
  const expectedWalletAddress = input.expectedWalletAddress
    ? normalizeSolanaAddress(input.expectedWalletAddress, "Expected Solana wallet is invalid.")
    : null;

  if (expectedWalletAddress && wallet.walletAddress !== expectedWalletAddress) {
    throw new Error("Reconnect the Solana wallet that was originally used for this order before paying.");
  }

  const connection = getSolanaConnection("confirmed");
  const amountInBaseUnits = amountToBaseUnits(input.amount, config.decimals, config.label);
  const solBalance = await connection.getBalance(wallet.publicKey, "confirmed");

  if (config.kind === "native") {
    logPaymentDebug("client-solana-wallet-balance", {
      connectedWalletAddress: wallet.walletAddress,
      amountExpected: normalizePaymentAmount(input.amount),
      balanceRaw: String(solBalance),
      paymentMethod: input.paymentMethod,
    });

    if (BigInt(solBalance) < amountInBaseUnits + 5000n) {
      throw new Error("Not enough SOL is available in the connected wallet for this payment and network fee.");
    }

    return wallet;
  }

  if (!config.mintAddress) {
    throw new Error(`The ${config.label} SPL mint is not configured.`);
  }

  const mint = new PublicKey(config.mintAddress);
  const sourceTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
  const tokenBalance = await connection.getTokenAccountBalance(sourceTokenAccount, "confirmed").catch(() => null);
  const balanceRaw = BigInt(tokenBalance?.value.amount || "0");
  const recipientAddress = normalizeSolanaAddress(
    input.recipientAddress || SOLANA_MERCHANT_WALLET_ADDRESS,
    "Recipient Solana wallet address is invalid.",
  );
  const recipientTokenAccount = await getAssociatedTokenAddress(mint, new PublicKey(recipientAddress));
  const recipientTokenAccountExists = Boolean(await connection.getAccountInfo(recipientTokenAccount, "confirmed"));
  const feeReserveLamports = recipientTokenAccountExists ? 10_000n : 3_000_000n;

  logPaymentDebug("client-solana-token-wallet-balance", {
    connectedWalletAddress: wallet.walletAddress,
    amountExpected: normalizePaymentAmount(input.amount),
    balanceRaw: balanceRaw.toString(),
    mintAddress: config.mintAddress,
    paymentMethod: input.paymentMethod,
    recipientTokenAccountExists,
  });

  if (balanceRaw < amountInBaseUnits) {
    throw new Error(`Not enough ${config.label} is available in the connected Phantom wallet for this payment.`);
  }

  if (BigInt(solBalance) < feeReserveLamports) {
    throw new Error("Not enough SOL is available in the connected Phantom wallet for Solana network fees.");
  }

  return wallet;
}

export async function sendSolanaPayment(input: SendSolanaPaymentInput): Promise<SendSolanaPaymentResult> {
  const config = getSolanaPaymentConfig(input.paymentMethod);
  const wallet = await validateSolanaWalletCanPay(input);
  const recipientAddress = normalizeSolanaAddress(
    input.recipientAddress || SOLANA_MERCHANT_WALLET_ADDRESS,
    "Recipient Solana wallet address is invalid.",
  );
  const connection = getSolanaConnection("confirmed");
  const transaction = new Transaction();
  const amountInBaseUnits = amountToBaseUnits(input.amount, config.decimals, config.label);

  if (config.kind === "native") {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(recipientAddress),
        lamports: Number(amountInBaseUnits),
      }),
    );
  } else {
    if (!config.mintAddress) {
      throw new Error(`The ${config.label} SPL mint is not configured.`);
    }

    const mint = new PublicKey(config.mintAddress);
    const sourceTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
    const recipientPublicKey = new PublicKey(recipientAddress);
    const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipientPublicKey);
    const recipientTokenAccountExists = Boolean(await connection.getAccountInfo(recipientTokenAccount, "confirmed"));

    if (!recipientTokenAccountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          recipientTokenAccount,
          recipientPublicKey,
          mint,
        ),
      );
    }

    transaction.add(
      createTransferCheckedInstruction(
        sourceTokenAccount,
        mint,
        recipientTokenAccount,
        wallet.publicKey,
        amountInBaseUnits,
        config.decimals,
      ),
    );
  }

  transaction.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  logPaymentDebug("client-solana-send-start", {
    connectedWalletAddress: wallet.walletAddress,
    recipientAddress,
    amountExpected: normalizePaymentAmount(input.amount),
    paymentMethod: input.paymentMethod,
    tokenStandard: config.tokenStandard,
    mintAddress: config.mintAddress || null,
  });

  let signature = "";

  if (wallet.provider.signAndSendTransaction) {
    const result = await wallet.provider.signAndSendTransaction(transaction);
    signature = result.signature;
  } else if (wallet.provider.signTransaction) {
    const signedTransaction = await wallet.provider.signTransaction(transaction);
    signature = await connection.sendRawTransaction(signedTransaction.serialize());
  } else {
    throw new Error("The connected Phantom wallet cannot sign Solana transactions from this browser.");
  }

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed").catch(() => null);

  if (!signature) {
    throw new Error("The Phantom wallet did not return a transaction signature.");
  }

  logPaymentDebug("client-solana-send-submitted", {
    connectedWalletAddress: wallet.walletAddress,
    recipientAddress,
    txHash: signature,
    paymentMethod: input.paymentMethod,
  });

  return {
    walletAddress: wallet.walletAddress,
    txHash: signature,
  };
}
