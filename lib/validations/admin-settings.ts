import { z } from "zod";

import { isAllowedBrandingAssetUrl } from "@/lib/security/asset-urls";

const text = (max: number, message: string) => z.string().trim().max(max, message);
const brandingAssetUrl = text(1000, "Branding asset URL is too long.").refine(
  (value) => !value || isAllowedBrandingAssetUrl(value),
  "Use an uploaded branding image or an approved site asset.",
);

const adminBranchLocationSchema = z.object({
  id: text(120, "Branch ID is too long."),
  name: text(160, "Branch name is too long."),
  address: text(500, "Branch address is too long."),
  country: text(120, "Branch country is too long."),
  stateProvince: text(120, "Branch state or province is too long."),
  city: text(120, "Branch city is too long."),
  postalCode: text(20, "Branch postal code is too long."),
  latitude: text(40, "Branch latitude is too long."),
  longitude: text(40, "Branch longitude is too long."),
});

export const adminGeneralSettingsSchema = z
  .object({
  storeName: text(120, "Store name is too long.").min(1, "Store name is required."),
  tagline: text(180, "Tagline is too long."),
  storeEmail: text(160, "Store email is too long.").email("Store email must be valid."),
  phoneNumber: text(60, "Phone number is too long."),
  logoUrl: brandingAssetUrl,
  faviconUrl: brandingAssetUrl,
  brandingVersion: text(80, "Branding version is too long."),
  defaultCurrency: text(80, "Default currency is too long."),
  currencyPosition: text(80, "Currency position is too long."),
  thousandSeparator: text(6, "Thousand separator is too long."),
  decimalSeparator: text(6, "Decimal separator is too long."),
  numberOfDecimals: text(2, "Number of decimals is too long."),
  fromName: text(120, "From name is too long."),
  fromEmail: text(160, "From email is too long.").email("From email must be valid."),
  replyToEmail: text(160, "Reply-to email is too long.").email("Reply-to email must be valid."),
  emailProvider: text(60, "Email provider is too long.").default("SMTP"),
  emailSslEnabled: z.boolean().default(true),
  emailSignature: text(500, "Email signature is too long."),
  storeAddress: text(500, "Store address is too long."),
  country: text(120, "Country is too long."),
  stateProvince: text(120, "State or province is too long."),
  city: text(120, "City is too long."),
  postalCode: text(20, "Postal code is too long."),
  latitude: text(40, "Latitude is too long.").default(""),
  longitude: text(40, "Longitude is too long.").default(""),
  branches: z.array(adminBranchLocationSchema).max(50, "Too many branch locations.").default([]),
  shippingPhilippinesEnabled: z.boolean().default(true),
  shippingAsiaEnabled: z.boolean().default(false),
  shippingRestOfWorldEnabled: z.boolean().default(false),
  evmEthEnabled: z.boolean().default(true),
  evmUsdcEnabled: z.boolean().default(true),
  evmUsdtEnabled: z.boolean().default(true),
  solEnabled: z.boolean().default(true),
  solUsdcEnabled: z.boolean().default(true),
  solUsdtEnabled: z.boolean().default(true),
  enableStore: z.boolean(),
  allowCustomerRegistration: z.boolean(),
  enableReviews: z.boolean(),
  enableWishlist: z.boolean(),
  vat12Enabled: z.boolean().default(true),
  reducedVat5Enabled: z.boolean().default(false),
  zeroRatedVat0Enabled: z.boolean().default(false),
  timezone: text(120, "Timezone is too long."),
  dateFormat: text(80, "Date format is too long."),
  timeFormat: text(80, "Time format is too long."),
  })
  .refine(
    (settings) =>
      [settings.vat12Enabled, settings.reducedVat5Enabled, settings.zeroRatedVat0Enabled].filter(Boolean).length <= 1,
    {
      message: "Only one VAT rate can be active at a time.",
      path: ["vat12Enabled"],
    },
  );
