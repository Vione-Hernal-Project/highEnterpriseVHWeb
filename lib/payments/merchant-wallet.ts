import "server-only";

import { getAddress, isAddress } from "ethers";
import { PublicKey } from "@solana/web3.js";

import { serverEnv } from "@/lib/env/server";
import { logPaymentDebug } from "@/lib/payments/debug";

type MerchantWalletResolution = {
  address: string;
  source: "env_configured";
};

function normalizeWalletAddress(address: string, fallbackMessage: string) {
  if (!isAddress(address)) {
    throw new Error(fallbackMessage);
  }

  return getAddress(address);
}

function normalizeSolanaWalletAddress(address: string, fallbackMessage: string) {
  try {
    return new PublicKey(address.trim()).toBase58();
  } catch {
    throw new Error(fallbackMessage);
  }
}

export async function resolveMerchantWalletAddress(): Promise<MerchantWalletResolution> {
  const configuredAddress = normalizeWalletAddress(
    serverEnv.merchantWalletAddress,
    "Merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_EVM_WALLET in .env.local.",
  );

  logPaymentDebug("merchant-wallet", {
    source: "env_configured",
    recipientAddress: configuredAddress,
  });

  return {
    address: configuredAddress,
    source: "env_configured",
  };
}

export async function resolveSolanaMerchantWalletAddress(): Promise<MerchantWalletResolution> {
  const configuredAddress = normalizeSolanaWalletAddress(
    serverEnv.solanaMerchantWalletAddress,
    "Solana merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_SOLANA_WALLET in .env.local.",
  );

  logPaymentDebug("merchant-wallet", {
    source: "env_configured",
    recipientAddress: configuredAddress,
    network: "solana",
  });

  return {
    address: configuredAddress,
    source: "env_configured",
  };
}
