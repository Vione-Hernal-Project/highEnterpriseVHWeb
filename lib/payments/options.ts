import { PublicKey } from "@solana/web3.js";
import { isAddress } from "ethers";

import { formatPhpCurrency } from "@/lib/payments/amounts";
import {
  ETH_TOKEN_DECIMALS,
  ETH_TOKEN_SYMBOL,
  MERCHANT_WALLET_ADDRESS,
  SOLANA_MERCHANT_WALLET_ADDRESS,
  SOLANA_NETWORK,
  SOLANA_RPC_URL,
  SOL_TOKEN_DECIMALS,
  SOL_TOKEN_SYMBOL,
  USDC_SOLANA_MINT_ADDRESS,
  USDC_TOKEN_ADDRESS,
  USDC_TOKEN_DECIMALS,
  USDC_TOKEN_SYMBOL,
  USDT_SOLANA_MINT_ADDRESS,
  USDT_TOKEN_ADDRESS,
  USDT_TOKEN_DECIMALS,
  USDT_TOKEN_SYMBOL,
} from "@/lib/web3/config";
import { ETHEREUM_MAINNET_NETWORK_NAME, SOLANA_MAINNET_NETWORK_NAME } from "@/lib/web3/network";

export const PAYMENT_METHOD_VALUES = ["evm_eth", "evm_usdc", "evm_usdt", "sol_sol", "sol_usdc", "sol_usdt"] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];
export type PaymentNetwork = "ethereum" | "solana";
export type WalletProvider = "metamask" | "phantom";
export type PaymentTokenType = "ETH" | "SOL" | "USDC" | "USDT";
export type PaymentTokenStandard = "native" | "erc20" | "spl";

type PaymentMethodOption = {
  value: PaymentMethod;
  label: PaymentTokenType;
  tokenType: PaymentTokenType;
  description: string;
  decimals: number;
  kind: "native" | "token";
  tokenStandard: PaymentTokenStandard;
  tokenAddress?: string;
  mintAddress?: string;
  network: PaymentNetwork;
  walletProvider: WalletProvider;
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    value: "evm_eth",
    label: ETH_TOKEN_SYMBOL,
    tokenType: "ETH",
    description: "Send ETH directly to the configured merchant wallet on Ethereum Mainnet.",
    decimals: ETH_TOKEN_DECIMALS,
    kind: "native",
    tokenStandard: "native",
    network: "ethereum",
    walletProvider: "metamask",
  },
  {
    value: "evm_usdc",
    label: USDC_TOKEN_SYMBOL,
    tokenType: "USDC",
    description: "Send USDC as an ERC-20 token to the configured merchant wallet on Ethereum Mainnet.",
    decimals: USDC_TOKEN_DECIMALS,
    kind: "token",
    tokenStandard: "erc20",
    tokenAddress: USDC_TOKEN_ADDRESS,
    network: "ethereum",
    walletProvider: "metamask",
  },
  {
    value: "evm_usdt",
    label: USDT_TOKEN_SYMBOL,
    tokenType: "USDT",
    description: "Send USDT as an ERC-20 token to the configured merchant wallet on Ethereum Mainnet.",
    decimals: USDT_TOKEN_DECIMALS,
    kind: "token",
    tokenStandard: "erc20",
    tokenAddress: USDT_TOKEN_ADDRESS,
    network: "ethereum",
    walletProvider: "metamask",
  },
  {
    value: "sol_sol",
    label: SOL_TOKEN_SYMBOL,
    tokenType: "SOL",
    description: `Send SOL directly to the configured merchant wallet on ${SOLANA_MAINNET_NETWORK_NAME}.`,
    decimals: SOL_TOKEN_DECIMALS,
    kind: "native",
    tokenStandard: "native",
    network: "solana",
    walletProvider: "phantom",
  },
  {
    value: "sol_usdc",
    label: USDC_TOKEN_SYMBOL,
    tokenType: "USDC",
    description: `Send USDC as an SPL token to the configured merchant wallet on ${SOLANA_MAINNET_NETWORK_NAME}.`,
    decimals: USDC_TOKEN_DECIMALS,
    kind: "token",
    tokenStandard: "spl",
    mintAddress: USDC_SOLANA_MINT_ADDRESS,
    network: "solana",
    walletProvider: "phantom",
  },
  {
    value: "sol_usdt",
    label: USDT_TOKEN_SYMBOL,
    tokenType: "USDT",
    description: `Send USDT as an SPL token to the configured merchant wallet on ${SOLANA_MAINNET_NETWORK_NAME}.`,
    decimals: USDT_TOKEN_DECIMALS,
    kind: "token",
    tokenStandard: "spl",
    mintAddress: USDT_SOLANA_MINT_ADDRESS,
    network: "solana",
    walletProvider: "phantom",
  },
];

export function isPaymentMethodValue(value: string | null | undefined): value is PaymentMethod {
  return PAYMENT_METHOD_VALUES.includes(value as PaymentMethod);
}

export function getPaymentMethodLabel(value: string | null | undefined) {
  const match = PAYMENT_METHOD_OPTIONS.find((option) => option.value === value);

  return match?.label || (value ? value.toUpperCase() : "Not set");
}

export function getPaymentMethodConfig(value: PaymentMethod | string | null | undefined) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value) ?? null;
}

export function isSolanaPaymentMethod(value: PaymentMethod | string | null | undefined) {
  return getPaymentMethodConfig(value)?.network === "solana";
}

export function isEvmPaymentMethod(value: PaymentMethod | string | null | undefined) {
  return getPaymentMethodConfig(value)?.network === "ethereum";
}

export function isPaymentMethodConfigured(value: PaymentMethod | string | null | undefined) {
  return getPaymentMethodSetupError(value) === null;
}

function isSolanaAddress(value: string | null | undefined) {
  try {
    return Boolean(new PublicKey((value || "").trim()).toBase58());
  } catch {
    return false;
  }
}

export function getPaymentMethodSetupError(value: PaymentMethod | string | null | undefined) {
  const config = getPaymentMethodConfig(value);

  if (!config) {
    return "Unsupported payment method.";
  }

  if (config.network === "solana") {
    if (SOLANA_NETWORK !== "mainnet-beta") {
      return "Wrong network selected. Please switch to Solana mainnet.";
    }

    if (!SOLANA_RPC_URL) {
      return "Solana RPC is not configured. Add NEXT_PUBLIC_SOLANA_RPC_URL to .env.local and restart the dev server.";
    }

    if (!SOLANA_MERCHANT_WALLET_ADDRESS) {
      return "Solana merchant wallet is not configured. Add NEXT_PUBLIC_MERCHANT_SOLANA_WALLET to .env.local and restart the dev server.";
    }

    if (!isSolanaAddress(SOLANA_MERCHANT_WALLET_ADDRESS)) {
      return "Solana merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_SOLANA_WALLET in .env.local and restart the dev server.";
    }

    if (config.kind === "token" && !config.mintAddress) {
      return `The ${config.label} SPL mint is not configured. Add NEXT_PUBLIC_${config.label}_SOLANA_MINT to .env.local and restart the dev server.`;
    }

    if (config.kind === "token" && !isSolanaAddress(config.mintAddress)) {
      return `The ${config.label} SPL mint is invalid. Update NEXT_PUBLIC_${config.label}_SOLANA_MINT in .env.local and restart the dev server.`;
    }

    return null;
  }

  if (!MERCHANT_WALLET_ADDRESS) {
    return "Merchant wallet is not configured. Add NEXT_PUBLIC_MERCHANT_EVM_WALLET to .env.local and restart the dev server.";
  }

  if (!isAddress(MERCHANT_WALLET_ADDRESS)) {
    return "Merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_EVM_WALLET in .env.local and restart the dev server.";
  }

  if (config.kind === "token" && !config.tokenAddress) {
    return `The ${config.label} ERC-20 contract is not configured for ${ETHEREUM_MAINNET_NETWORK_NAME}. Add NEXT_PUBLIC_${config.label}_EVM_CONTRACT to .env.local and restart the dev server.`;
  }

  if (config.kind === "token" && !isAddress(config.tokenAddress || "")) {
    return `The ${config.label} ERC-20 contract is invalid. Update NEXT_PUBLIC_${config.label}_EVM_CONTRACT in .env.local and restart the dev server.`;
  }

  return null;
}

export function getPaymentMethodNetworkName(value: PaymentMethod | string | null | undefined) {
  const config = getPaymentMethodConfig(value);

  if (config?.network === "solana") {
    return SOLANA_MAINNET_NETWORK_NAME;
  }

  return ETHEREUM_MAINNET_NETWORK_NAME;
}

export function formatAmountWithUnit(amount: string | number, unit: string | null | undefined) {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;

  if ((unit || "").toUpperCase() === "PHP") {
    return formatPhpCurrency(safeAmount);
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(safeAmount);

  return `${formatted} ${unit || ""}`.trim();
}
