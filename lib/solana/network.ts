import { Connection, PublicKey } from "@solana/web3.js";

import { SOLANA_NETWORK, SOLANA_RPC_URL } from "@/lib/web3/config";

const SOLANA_MAINNET_NETWORK = "mainnet-beta";

export function assertSolanaMainnetConfig() {
  if (SOLANA_NETWORK !== SOLANA_MAINNET_NETWORK) {
    throw new Error("Wrong network selected. Please switch to Solana mainnet.");
  }

  if (!SOLANA_RPC_URL) {
    throw new Error("Solana RPC is not configured. Add NEXT_PUBLIC_SOLANA_RPC_URL to .env.local and restart the Next.js dev server.");
  }
}

export function getSolanaConnection(commitment: "confirmed" | "finalized" = "confirmed") {
  assertSolanaMainnetConfig();

  return new Connection(SOLANA_RPC_URL, commitment);
}

export function normalizeSolanaAddress(address: string | null | undefined, fallbackMessage = "Solana wallet address is invalid.") {
  try {
    return new PublicKey((address || "").trim()).toBase58();
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function isSolanaAddress(address: string | null | undefined) {
  try {
    normalizeSolanaAddress(address);
    return true;
  } catch {
    return false;
  }
}
