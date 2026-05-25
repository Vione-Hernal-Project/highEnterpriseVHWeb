import { formatUnits, parseUnits } from "ethers";

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
  return convertPhpCentsToCryptoAmount(phpCents, phpPerEth, 18);
}

export function convertPhpCentsToCryptoAmount(phpCents: number, phpPerAsset: number, decimals = 18) {
  const cryptoAmount = phpCents / 100 / phpPerAsset;

  return normalizePaymentAmount(cryptoAmount.toFixed(decimals));
}

export function addCryptoAmountBuffer(value: string | number, bufferPercent: number, decimals = 18) {
  const normalizedValue = normalizePaymentAmount(value);
  const baseUnits = parseUnits(normalizedValue, decimals);
  const bufferBasisPoints = Math.max(0, Math.round(bufferPercent * 100));
  const divisor = 10_000n;
  const bufferUnits = (baseUnits * BigInt(bufferBasisPoints) + divisor - 1n) / divisor;
  const totalUnits = baseUnits + bufferUnits;

  return {
    baseAmount: normalizePaymentAmount(formatUnits(baseUnits, decimals)),
    bufferAmount: normalizePaymentAmount(formatUnits(bufferUnits, decimals)),
    totalAmount: normalizePaymentAmount(formatUnits(totalUnits, decimals)),
  };
}

export function convertEthToPhpCents(value: string | number, phpPerEth: number) {
  return convertCryptoToPhpCents(value, phpPerEth);
}

export function convertCryptoToPhpCents(value: string | number, phpPerAsset: number) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(numeric * phpPerAsset * 100);
}

export function isEthAmountAtLeast(value: string | number, minimum: string | number) {
  return isCryptoAmountAtLeast(value, minimum, 18);
}

export function isCryptoAmountAtLeast(value: string | number, minimum: string | number, decimals = 18) {
  try {
    return parseUnits(normalizePaymentAmount(value), decimals) >= parseUnits(normalizePaymentAmount(minimum), decimals);
  } catch {
    return false;
  }
}
