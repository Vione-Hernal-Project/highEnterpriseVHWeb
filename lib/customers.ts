import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export const CUSTOMER_CACHE_TAG = "admin-customers";
const CUSTOMER_CACHE_REVALIDATE_SECONDS = 30;

export type AdminCustomerRecord = {
  id: string;
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  customerType: string;
  source: string;
  customerGroup: string;
  vipLevel: string;
  referralBy: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  accountStatus: "active" | "inactive" | "blocked";
  emailVerification: "verified" | "unverified";
  hasAccountAccess: boolean;
  subscriptionStatus: "subscribed" | "unsubscribed" | "pending";
  subscribedOn: string | null;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export function isMissingCustomersTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.customers\" does not exist") || message.includes("schema cache");
}

function parseTags(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mapCustomerRow(row: CustomerRow): AdminCustomerRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneCountryCode: row.phone_country_code,
    phoneNumber: row.phone_number || "",
    dateOfBirth: row.date_of_birth,
    customerType: row.customer_type || "",
    source: row.source || "",
    customerGroup: row.customer_group || "",
    vipLevel: row.vip_level || "",
    referralBy: row.referral_by || "",
    addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || "",
    city: row.city || "",
    stateProvince: row.state_province || "",
    postalCode: row.postal_code || "",
    country: row.country || "",
    accountStatus: row.account_status === "inactive" || row.account_status === "blocked" ? row.account_status : "active",
    emailVerification: row.email_verification === "verified" ? "verified" : "unverified",
    hasAccountAccess: row.has_account_access,
    subscriptionStatus: row.subscription_status === "subscribed" || row.subscription_status === "pending" ? row.subscription_status : "unsubscribed",
    subscribedOn: row.subscribed_on,
    tags: parseTags(row.tags),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadCustomerRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("customers").select("*").order("created_at", { ascending: false });

  if (error) {
    if (isMissingCustomersTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as CustomerRow[];
}

const loadCachedCustomerRows = cache(async () => loadCustomerRows(), ["admin-customer-rows"], {
  revalidate: CUSTOMER_CACHE_REVALIDATE_SECONDS,
  tags: [CUSTOMER_CACHE_TAG],
});

export async function loadAdminManualCustomers() {
  const rows = await loadCachedCustomerRows();

  return rows.map(mapCustomerRow);
}
