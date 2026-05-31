import { Connection, PublicKey } from "@solana/web3.js";

import { SOLANA_NETWORK, SOLANA_RPC_URL } from "@/lib/web3/config";

const SOLANA_MAINNET_NETWORK = "mainnet-beta";
const SOLANA_MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

let solanaMainnetIdentityPromise: Promise<string> | null = null;

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

export async function assertSolanaMainnetConnection(connection = getSolanaConnection("confirmed")) {
  assertSolanaMainnetConfig();

  if (!solanaMainnetIdentityPromise) {
    solanaMainnetIdentityPromise = connection.getGenesisHash().catch((error) => {
      solanaMainnetIdentityPromise = null;
      throw error;
    });
  }

  const genesisHash = await solanaMainnetIdentityPromise;

  if (genesisHash !== SOLANA_MAINNET_GENESIS_HASH) {
    solanaMainnetIdentityPromise = null;
    throw new Error("Configured Solana RPC is not connected to Solana mainnet.");
  }

  return genesisHash;
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
