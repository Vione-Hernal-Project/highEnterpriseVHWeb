import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

export const CAMPAIGN_CACHE_TAG = "admin-campaigns";
const CAMPAIGN_CACHE_REVALIDATE_SECONDS = 30;

export type AdminCampaignRecord = {
  id: string;
  name: string;
  campaignType: string;
  goal: string;
  description: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  budgetAmount: string | null;
  dailyBudgetAmount: string | null;
  tags: string[];
  channels: string[];
  audienceType: string;
  audience: string;
  trackConversions: boolean;
  abTestEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function isMissingCampaignsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.campaigns\" does not exist") || message.includes("schema cache");
}

function parseStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function resolveCampaignStatus(campaign: Pick<AdminCampaignRecord, "status" | "startsAt" | "endsAt">) {
  const now = Date.now();
  const status = campaign.status.toLowerCase();

  if (status === "disabled" || status === "paused" || status === "draft") {
    return status;
  }

  if (campaign.endsAt && Date.parse(campaign.endsAt) < now) {
    return "completed";
  }

  if (campaign.startsAt && Date.parse(campaign.startsAt) > now) {
    return "scheduled";
  }

  return status || "active";
}

function mapCampaignRow(row: CampaignRow): AdminCampaignRecord {
  const campaign = {
    id: row.id,
    name: row.name,
    campaignType: row.campaign_type,
    goal: row.goal || "",
    description: row.description || "",
    status: row.status || "active",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    budgetAmount: row.budget_amount,
    dailyBudgetAmount: row.daily_budget_amount,
    tags: parseStringArray(row.tags),
    channels: parseStringArray(row.channels),
    audienceType: row.audience_type,
    audience: row.audience || "",
    trackConversions: row.track_conversions,
    abTestEnabled: row.ab_test_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    ...campaign,
    status: resolveCampaignStatus(campaign),
  };
}

async function loadCampaignRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("campaigns").select("*").order("created_at", { ascending: false });

  if (error) {
    if (isMissingCampaignsTableError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as CampaignRow[];
}

const loadCachedCampaignRows = cache(async () => loadCampaignRows(), ["admin-campaign-rows"], {
  revalidate: CAMPAIGN_CACHE_REVALIDATE_SECONDS,
  tags: [CAMPAIGN_CACHE_TAG],
});

export async function loadAdminCampaignRecords() {
  const rows = await loadCachedCampaignRows();

  return rows.map(mapCampaignRow);
}
