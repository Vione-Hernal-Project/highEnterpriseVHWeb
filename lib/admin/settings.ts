import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { CheckoutAvailabilitySettings } from "@/lib/checkout-availability";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSettingRow = Database["public"]["Tables"]["admin_settings"]["Row"];

export const ADMIN_SETTINGS_CACHE_TAG = "admin-settings";
const ADMIN_SETTINGS_CACHE_REVALIDATE_SECONDS = 30;
export const GENERAL_SETTINGS_KEY = "general";

export type AdminBranchLocation = {
  id: string;
  name: string;
  address: string;
  country: string;
  stateProvince: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
};

export type AdminGeneralSettings = CheckoutAvailabilitySettings & {
  storeName: string;
  tagline: string;
  storeEmail: string;
  phoneNumber: string;
  logoUrl: string;
  faviconUrl: string;
  brandingVersion: string;
  defaultCurrency: string;
  currencyPosition: string;
  thousandSeparator: string;
  decimalSeparator: string;
  numberOfDecimals: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  emailProvider: string;
  emailSslEnabled: boolean;
  emailSignature: string;
  storeAddress: string;
  country: string;
  stateProvince: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  branches: AdminBranchLocation[];
  enableStore: boolean;
  allowCustomerRegistration: boolean;
  enableReviews: boolean;
  enableWishlist: boolean;
  vat12Enabled: boolean;
  reducedVat5Enabled: boolean;
  zeroRatedVat0Enabled: boolean;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

export const DEFAULT_GENERAL_SETTINGS: AdminGeneralSettings = {
  storeName: "Vione Hernal",
  tagline: "Elegance in every stitch",
  storeEmail: "support@vionehernal.com",
  phoneNumber: "+1 234 567 8900",
  logoUrl: "/assets/images/vh-logo-v2.jpg",
  faviconUrl: "/assets/images/vh-logo-v2.jpg",
  brandingVersion: "default",
  defaultCurrency: "PHP",
  currencyPosition: "left",
  thousandSeparator: ",",
  decimalSeparator: ".",
  numberOfDecimals: "2",
  fromName: "Vione Hernal",
  fromEmail: "no-reply@vionehernal.com",
  replyToEmail: "support@vionehernal.com",
  emailProvider: "SMTP",
  emailSslEnabled: true,
  emailSignature: "Thank you,\nVione Hernal Team",
  storeAddress: "123 Fashion Street,\nMakati City, Metro Manila, 1200 Philippines",
  country: "Philippines",
  stateProvince: "Metro Manila",
  city: "Makati City",
  postalCode: "1200",
  latitude: "14.5547",
  longitude: "121.0244",
  branches: [],
  shippingPhilippinesEnabled: true,
  shippingAsiaEnabled: false,
  shippingRestOfWorldEnabled: false,
  evmEthEnabled: true,
  evmUsdcEnabled: true,
  evmUsdtEnabled: true,
  solEnabled: true,
  solUsdcEnabled: true,
  solUsdtEnabled: true,
  enableStore: true,
  allowCustomerRegistration: true,
  enableReviews: true,
  enableWishlist: false,
  vat12Enabled: true,
  reducedVat5Enabled: false,
  zeroRatedVat0Enabled: false,
  timezone: "Asia/Manila",
  dateFormat: "MMM d, yyyy",
  timeFormat: "h:mm a",
};

export function isMissingAdminSettingsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.admin_settings\" does not exist") || message.includes("schema cache");
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && !Array.isArray(value) && typeof value === "object");
}

function readString(settings: Record<string, Json | undefined>, key: keyof AdminGeneralSettings) {
  const value = settings[key];

  return typeof value === "string" ? value : DEFAULT_GENERAL_SETTINGS[key] as string;
}

function readBoolean(settings: Record<string, Json | undefined>, key: keyof AdminGeneralSettings) {
  const value = settings[key];

  return typeof value === "boolean" ? value : DEFAULT_GENERAL_SETTINGS[key] as boolean;
}

function readBranchString(settings: Record<string, Json | undefined>, key: keyof AdminBranchLocation) {
  const value = settings[key];

  return typeof value === "string" ? value : "";
}

function readBranchLocations(settings: Record<string, Json | undefined>) {
  const branches = settings.branches;

  if (!Array.isArray(branches)) {
    return DEFAULT_GENERAL_SETTINGS.branches;
  }

  return branches
    .slice(0, 50)
    .map((branch, index) => {
      if (!isRecord(branch)) {
        return null;
      }

      return {
        id: readBranchString(branch, "id") || `branch-${index + 1}`,
        name: readBranchString(branch, "name"),
        address: readBranchString(branch, "address"),
        country: readBranchString(branch, "country"),
        stateProvince: readBranchString(branch, "stateProvince"),
        city: readBranchString(branch, "city"),
        postalCode: readBranchString(branch, "postalCode"),
        latitude: readBranchString(branch, "latitude"),
        longitude: readBranchString(branch, "longitude"),
      };
    })
    .filter((branch): branch is AdminBranchLocation => Boolean(branch));
}

function mapGeneralSettings(row: AdminSettingRow | null): AdminGeneralSettings {
  const settings = isRecord(row?.value) ? row.value : {};

  return {
    storeName: readString(settings, "storeName"),
    tagline: readString(settings, "tagline"),
    storeEmail: readString(settings, "storeEmail"),
    phoneNumber: readString(settings, "phoneNumber"),
    logoUrl: readString(settings, "logoUrl"),
    faviconUrl: readString(settings, "faviconUrl"),
    brandingVersion: readString(settings, "brandingVersion"),
    defaultCurrency: readString(settings, "defaultCurrency"),
    currencyPosition: readString(settings, "currencyPosition"),
    thousandSeparator: readString(settings, "thousandSeparator"),
    decimalSeparator: readString(settings, "decimalSeparator"),
    numberOfDecimals: readString(settings, "numberOfDecimals"),
    fromName: readString(settings, "fromName"),
    fromEmail: readString(settings, "fromEmail"),
    replyToEmail: readString(settings, "replyToEmail"),
    emailProvider: readString(settings, "emailProvider"),
    emailSslEnabled: readBoolean(settings, "emailSslEnabled"),
    emailSignature: readString(settings, "emailSignature"),
    storeAddress: readString(settings, "storeAddress"),
    country: readString(settings, "country"),
    stateProvince: readString(settings, "stateProvince"),
    city: readString(settings, "city"),
    postalCode: readString(settings, "postalCode"),
    latitude: readString(settings, "latitude"),
    longitude: readString(settings, "longitude"),
    branches: readBranchLocations(settings),
    shippingPhilippinesEnabled: readBoolean(settings, "shippingPhilippinesEnabled"),
    shippingAsiaEnabled: readBoolean(settings, "shippingAsiaEnabled"),
    shippingRestOfWorldEnabled: readBoolean(settings, "shippingRestOfWorldEnabled"),
    evmEthEnabled: readBoolean(settings, "evmEthEnabled"),
    evmUsdcEnabled: readBoolean(settings, "evmUsdcEnabled"),
    evmUsdtEnabled: readBoolean(settings, "evmUsdtEnabled"),
    solEnabled: readBoolean(settings, "solEnabled"),
    solUsdcEnabled: readBoolean(settings, "solUsdcEnabled"),
    solUsdtEnabled: readBoolean(settings, "solUsdtEnabled"),
    enableStore: readBoolean(settings, "enableStore"),
    allowCustomerRegistration: readBoolean(settings, "allowCustomerRegistration"),
    enableReviews: readBoolean(settings, "enableReviews"),
    enableWishlist: readBoolean(settings, "enableWishlist"),
    vat12Enabled: readBoolean(settings, "vat12Enabled"),
    reducedVat5Enabled: readBoolean(settings, "reducedVat5Enabled"),
    zeroRatedVat0Enabled: readBoolean(settings, "zeroRatedVat0Enabled"),
    timezone: readString(settings, "timezone"),
    dateFormat: readString(settings, "dateFormat"),
    timeFormat: readString(settings, "timeFormat"),
  };
}

async function loadGeneralSettingsRow() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("admin_settings").select("*").eq("key", GENERAL_SETTINGS_KEY).maybeSingle();

  if (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data as AdminSettingRow | null;
}

const loadCachedGeneralSettingsRow = cache(async () => loadGeneralSettingsRow(), ["admin-general-settings-row"], {
  revalidate: ADMIN_SETTINGS_CACHE_REVALIDATE_SECONDS,
  tags: [ADMIN_SETTINGS_CACHE_TAG],
});

export async function loadAdminGeneralSettings() {
  const row = await loadCachedGeneralSettingsRow();

  return mapGeneralSettings(row);
}

export async function loadFreshAdminGeneralSettings() {
  const row = await loadGeneralSettingsRow();

  return mapGeneralSettings(row);
}

export type PublicBrandingSettings = Pick<AdminGeneralSettings, "storeName" | "logoUrl" | "faviconUrl" | "brandingVersion">;

export function versionAssetUrl(url: string, version: string) {
  if (!url || version === "default") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export async function loadPublicBrandingSettings(): Promise<PublicBrandingSettings> {
  try {
    const settings = await loadAdminGeneralSettings();

    return {
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      brandingVersion: settings.brandingVersion,
    };
  } catch {
    return {
      storeName: DEFAULT_GENERAL_SETTINGS.storeName,
      logoUrl: DEFAULT_GENERAL_SETTINGS.logoUrl,
      faviconUrl: DEFAULT_GENERAL_SETTINGS.faviconUrl,
      brandingVersion: DEFAULT_GENERAL_SETTINGS.brandingVersion,
    };
  }
}
