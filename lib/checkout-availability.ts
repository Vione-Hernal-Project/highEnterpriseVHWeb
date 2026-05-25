import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/payments/options";

export type ShippingCountryZoneCode = "philippines" | "asia" | "rest_of_world";

export type CheckoutAvailabilitySettings = {
  shippingPhilippinesEnabled: boolean;
  shippingAsiaEnabled: boolean;
  shippingRestOfWorldEnabled: boolean;
  evmEthEnabled: boolean;
  evmUsdcEnabled: boolean;
  evmUsdtEnabled: boolean;
  solEnabled: boolean;
  solUsdcEnabled: boolean;
  solUsdtEnabled: boolean;
};

export const DEFAULT_CHECKOUT_AVAILABILITY_SETTINGS: CheckoutAvailabilitySettings = {
  shippingPhilippinesEnabled: true,
  shippingAsiaEnabled: false,
  shippingRestOfWorldEnabled: false,
  evmEthEnabled: true,
  evmUsdcEnabled: true,
  evmUsdtEnabled: true,
  solEnabled: true,
  solUsdcEnabled: true,
  solUsdtEnabled: true,
};

export const SHIPPING_ZONE_AVAILABILITY_OPTIONS: Array<{
  code: ShippingCountryZoneCode;
  label: string;
  settingsKey: keyof CheckoutAvailabilitySettings;
}> = [
  { code: "philippines", label: "Philippines", settingsKey: "shippingPhilippinesEnabled" },
  { code: "asia", label: "Asia", settingsKey: "shippingAsiaEnabled" },
  { code: "rest_of_world", label: "Rest of World", settingsKey: "shippingRestOfWorldEnabled" },
];

export const PAYMENT_METHOD_AVAILABILITY_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
  settingsKey: keyof CheckoutAvailabilitySettings;
}> = [
  { value: "evm_eth", label: "EVM ETH", settingsKey: "evmEthEnabled" },
  { value: "evm_usdc", label: "EVM USDC", settingsKey: "evmUsdcEnabled" },
  { value: "evm_usdt", label: "EVM USDT", settingsKey: "evmUsdtEnabled" },
  { value: "sol_sol", label: "SOL", settingsKey: "solEnabled" },
  { value: "sol_usdc", label: "SOL USDC", settingsKey: "solUsdcEnabled" },
  { value: "sol_usdt", label: "SOL USDT", settingsKey: "solUsdtEnabled" },
];

const ASIA_COUNTRIES = new Set([
  "brunei",
  "cambodia",
  "china",
  "hong kong",
  "india",
  "indonesia",
  "japan",
  "laos",
  "malaysia",
  "myanmar",
  "singapore",
  "south korea",
  "taiwan",
  "thailand",
  "vietnam",
]);

function normalizeCountry(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getShippingCountryZone(country: string | null | undefined): ShippingCountryZoneCode {
  const normalizedCountry = normalizeCountry(country);

  if (!normalizedCountry || normalizedCountry === "philippines") {
    return "philippines";
  }

  return ASIA_COUNTRIES.has(normalizedCountry) ? "asia" : "rest_of_world";
}

export function getShippingCountryZoneLabel(zone: ShippingCountryZoneCode) {
  return SHIPPING_ZONE_AVAILABILITY_OPTIONS.find((option) => option.code === zone)?.label || "Shipping zone";
}

export function isShippingCountryZoneEnabled(
  settings: CheckoutAvailabilitySettings,
  zone: ShippingCountryZoneCode,
) {
  const option = SHIPPING_ZONE_AVAILABILITY_OPTIONS.find((item) => item.code === zone);

  return option ? Boolean(settings[option.settingsKey]) : false;
}

export function isShippingCountryEnabled(settings: CheckoutAvailabilitySettings, country: string | null | undefined) {
  return isShippingCountryZoneEnabled(settings, getShippingCountryZone(country));
}

export function isPaymentMethodEnabled(settings: CheckoutAvailabilitySettings, paymentMethod: PaymentMethod | string | null | undefined) {
  const option = PAYMENT_METHOD_AVAILABILITY_OPTIONS.find((item) => item.value === paymentMethod);

  return option ? Boolean(settings[option.settingsKey]) : false;
}

export function getEnabledPaymentMethodOptions(settings: CheckoutAvailabilitySettings) {
  return PAYMENT_METHOD_OPTIONS.filter((option) => isPaymentMethodEnabled(settings, option.value));
}
