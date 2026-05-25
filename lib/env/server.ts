import "server-only";

import { logPaymentDebug } from "@/lib/payments/debug";
import { ETHEREUM_MAINNET_RPC_ENV_NAME } from "@/lib/web3/network";

function stripWrappingQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function normalizeRpcUrl(value: string) {
  const trimmed = stripWrappingQuotes(value);

  if (!trimmed) {
    return "";
  }

  const protocolMatches = [...trimmed.matchAll(/https?:\/\//g)];
  const normalized =
    protocolMatches.length > 1 ? trimmed.slice(protocolMatches[protocolMatches.length - 1]!.index ?? 0) : trimmed;

  if (normalized !== trimmed) {
    logPaymentDebug("rpc-url-normalized", {
      reason: "multiple_protocol_segments_detected",
      normalizedHost: safeRpcHost(normalized),
    });
  }

  return normalized;
}

function safeRpcHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

export const serverEnv = {
  publicSiteUrl: process.env.PUBLIC_SITE_URL?.trim() ?? process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  merchantWalletAddress:
    process.env.NEXT_PUBLIC_MERCHANT_EVM_WALLET?.trim() || process.env.NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS?.trim() || "",
  solanaMerchantWalletAddress:
    process.env.NEXT_PUBLIC_MERCHANT_SOLANA_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_MERCHANT_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_MERCHANT_WALLET_ADDRESS?.trim() ||
    "",
  ethereumMainnetRpcUrl: normalizeRpcUrl(process.env.ETHEREUM_MAINNET_RPC_URL?.trim() ?? ""),
  solanaRpcUrl: normalizeRpcUrl(process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || process.env.SOLANA_RPC_URL?.trim() || ""),
  solanaNetwork: process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim() ?? "",
  usdcTokenAddress:
    process.env.NEXT_PUBLIC_USDC_EVM_CONTRACT?.trim() || process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS?.trim() || "",
  usdtTokenAddress:
    process.env.NEXT_PUBLIC_USDT_EVM_CONTRACT?.trim() || process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS?.trim() || "",
  usdcSolanaMintAddress: process.env.NEXT_PUBLIC_USDC_SOLANA_MINT?.trim() ?? "",
  usdtSolanaMintAddress: process.env.NEXT_PUBLIC_USDT_SOLANA_MINT?.trim() ?? "",
  vhlTokenAddress: process.env.NEXT_PUBLIC_VHL_TOKEN_ADDRESS?.trim() ?? "",
  storeOwnerEmails: process.env.STORE_OWNER_EMAILS?.trim() ?? "",
  smtpHost: process.env.SMTP_HOST?.trim() ?? "",
  smtpPort: Number(process.env.SMTP_PORT?.trim() ?? "0"),
  smtpSecure: process.env.SMTP_SECURE?.trim() === "true",
  smtpUser: process.env.SMTP_USER?.trim() ?? "",
  smtpPass: process.env.SMTP_PASS?.trim() ?? "",
  smtpFrom: process.env.SMTP_FROM?.trim() ?? "",
  storeNotificationEmail: process.env.STORE_NOTIFICATION_EMAIL?.trim() ?? "",
};

export function assertServerEnv(values: string[], message: string) {
  if (values.some((value) => !value)) {
    throw new Error(message);
  }
}

export function hasSupabaseAdminEnv() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceRoleKey);
}

export function getSupabaseAdminEnvError() {
  if (hasSupabaseAdminEnv()) {
    return null;
  }

  return "Supabase service role credentials are missing. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the Next.js dev server.";
}

export function hasEthereumMainnetRpcEnv() {
  return Boolean(serverEnv.ethereumMainnetRpcUrl);
}

export function getEthereumMainnetRpcEnvError() {
  if (hasEthereumMainnetRpcEnv()) {
    return null;
  }

  return `Ethereum Mainnet RPC is not configured. Add ${ETHEREUM_MAINNET_RPC_ENV_NAME} to .env.local and restart the Next.js dev server.`;
}

export function getSolanaRpcEnvError() {
  if (serverEnv.solanaNetwork !== "mainnet-beta") {
    return "Wrong network selected. Please switch to Solana mainnet.";
  }

  if (!serverEnv.solanaRpcUrl) {
    return "Solana RPC is not configured. Add NEXT_PUBLIC_SOLANA_RPC_URL to .env.local and restart the Next.js dev server.";
  }

  return null;
}

export function getConfiguredOwnerEmails() {
  return serverEnv.storeOwnerEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isSmtpConfigured() {
  return Boolean(serverEnv.smtpHost && serverEnv.smtpPort && serverEnv.smtpFrom);
}
