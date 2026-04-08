import {
  ETH_TOKEN_DECIMALS,
  ETH_TOKEN_SYMBOL,
  MERCHANT_WALLET_ADDRESS,
  USDC_TOKEN_ADDRESS,
  USDC_TOKEN_DECIMALS,
  USDC_TOKEN_SYMBOL,
  USDT_TOKEN_ADDRESS,
  USDT_TOKEN_DECIMALS,
  USDT_TOKEN_SYMBOL,
  VHL_TOKEN_ADDRESS,
  VHL_TOKEN_DECIMALS,
  VHL_TOKEN_SYMBOL,
} from "@/lib/web3/config";
import { formatPhpCurrency } from "@/lib/payments/amounts";

export const PAYMENT_METHOD_VALUES = ["eth", "usdc", "usdt", "vhl"] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

type PaymentMethodOption = {
  value: PaymentMethod;
  label: string;
  description: string;
  decimals: number;
  kind: "native" | "token";
  tokenAddress?: string;
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    value: "eth",
    label: ETH_TOKEN_SYMBOL,
    description: "Send Sepolia ETH directly to the configured merchant wallet.",
    decimals: ETH_TOKEN_DECIMALS,
    kind: "native",
  },
  {
    value: "usdc",
    label: USDC_TOKEN_SYMBOL,
    description: "Send test USDC on Sepolia to the configured merchant wallet.",
    decimals: USDC_TOKEN_DECIMALS,
    kind: "token",
    tokenAddress: USDC_TOKEN_ADDRESS,
  },
  {
    value: "usdt",
    label: USDT_TOKEN_SYMBOL,
    description: "Send test USDT on Sepolia to the configured merchant wallet.",
    decimals: USDT_TOKEN_DECIMALS,
    kind: "token",
    tokenAddress: USDT_TOKEN_ADDRESS,
  },
  {
    value: "vhl",
    label: VHL_TOKEN_SYMBOL,
    description: "Send Vione Hernal test tokens on Sepolia to the configured merchant wallet.",
    decimals: VHL_TOKEN_DECIMALS,
    kind: "token",
    tokenAddress: VHL_TOKEN_ADDRESS,
  },
];

export function getPaymentMethodLabel(value: string | null | undefined) {
  const match = PAYMENT_METHOD_OPTIONS.find((option) => option.value === value);

  return match?.label || (value ? value.toUpperCase() : "Not set");
}

export function getPaymentMethodConfig(value: PaymentMethod | string | null | undefined) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value) ?? null;
}

export function isPaymentMethodConfigured(value: PaymentMethod | string | null | undefined) {
  const config = getPaymentMethodConfig(value);

  if (!config || !MERCHANT_WALLET_ADDRESS) {
    return false;
  }

  return config.kind === "native" ? true : Boolean(config.tokenAddress);
}

export function getPaymentMethodSetupError(value: PaymentMethod | string | null | undefined) {
  const config = getPaymentMethodConfig(value);

  if (!config) {
    return "Unsupported payment method.";
  }

  if (!MERCHANT_WALLET_ADDRESS) {
    return "Merchant wallet is not configured. Add NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS to .env.local and restart the dev server.";
  }

  if (config.kind === "token" && !config.tokenAddress) {
    return `The ${config.label} Sepolia token address is not configured. Add the correct NEXT_PUBLIC_${config.label}_TOKEN_ADDRESS value to .env.local and restart the dev server.`;
  }

  return null;
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
