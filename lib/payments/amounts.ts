import { parseUnits } from "ethers";

export function normalizePaymentAmount(value: string | number) {
  const rawValue = typeof value === "number" ? value.toString() : value.trim();

  if (!rawValue) {
    return "0";
  }

  const [integerPart = "0", decimalPart = ""] = rawValue.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const normalizedDecimal = decimalPart.replace(/0+$/, "");

  return normalizedDecimal ? `${normalizedInteger}.${normalizedDecimal}` : normalizedInteger;
}

export function formatPhpCurrency(amount: string | number) {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatPhpCurrencyFromCents(cents: number) {
  return formatPhpCurrency(cents / 100);
}

export function phpCentsToDecimalString(cents: number) {
  return (cents / 100).toFixed(2);
}

export function parsePhpInputToCents(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[₱,\s]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(numeric * 100);
}

export function convertPhpCentsToEthAmount(phpCents: number, phpPerEth: number) {
  const ethAmount = phpCents / 100 / phpPerEth;

  return normalizePaymentAmount(ethAmount.toFixed(18));
}

export function convertEthToPhpCents(value: string | number, phpPerEth: number) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(numeric * phpPerEth * 100);
}

export function isEthAmountAtLeast(value: string | number, minimum: string | number) {
  try {
    return parseUnits(normalizePaymentAmount(value), 18) >= parseUnits(normalizePaymentAmount(minimum), 18);
  } catch {
    return false;
  }
}
