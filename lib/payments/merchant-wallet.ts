import "server-only";

import { getAddress, isAddress } from "ethers";

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

export async function resolveMerchantWalletAddress(): Promise<MerchantWalletResolution> {
  const configuredAddress = normalizeWalletAddress(
    serverEnv.merchantWalletAddress,
    "Merchant wallet is invalid. Update NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS in .env.local.",
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
