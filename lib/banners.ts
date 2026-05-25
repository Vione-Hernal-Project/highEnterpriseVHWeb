import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type BannerRow = Database["public"]["Tables"]["banners"]["Row"];

export const BANNER_CACHE_TAG = "site-banners";
const BANNER_CACHE_REVALIDATE_SECONDS = 30;

export type BannerStatus = "active" | "inactive" | "draft";
export type BannerVisibility = "public" | "logged_in" | "password";

export type BannerRecord = {
  id: string;
  title: string;
  bannerType: string;
  linkUrl: string | null;
  linkTarget: "same_window" | "new_tab";
  priority: number;
  displayOrder: number;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  heading: string;
  subheading: string;
  description: string;
  buttonText: string;
  buttonStyle: string;
  status: BannerStatus;
  visibility: BannerVisibility;
  displayOn: string;
  device: string;
  startsAt: string | null;
  endsAt: string | null;
  showHomepageOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export function normalizeBannerStorageKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isMissingBannersTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.banners\" does not exist") || message.includes("schema cache");
}

function normalizeStatus(value: string): BannerStatus {
  if (value === "active" || value === "inactive") {
    return value;
  }

  return "draft";
}

function normalizeVisibility(value: string): BannerVisibility {
  if (value === "logged_in" || value === "password") {
    return value;
  }

  return "public";
}

function mapBannerRow(row: BannerRow): BannerRecord {
  return {
    id: row.id,
    title: row.title,
    bannerType: row.banner_type,
    linkUrl: row.link_url,
    linkTarget: row.link_target === "new_tab" ? "new_tab" : "same_window",
    priority: row.priority,
    displayOrder: row.display_order,
    imageUrl: row.image_url,
    mobileImageUrl: row.mobile_image_url,
    heading: row.heading || "",
    subheading: row.subheading || "",
    description: row.description || "",
    buttonText: row.button_text || "",
    buttonStyle: row.button_style || "Primary",
    status: normalizeStatus(row.status),
    visibility: normalizeVisibility(row.visibility),
    displayOn: row.display_on || "All Locations",
    device: row.device || "All Devices",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    showHomepageOnly: row.show_homepage_only,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadBannerRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("banners")
    .select("*")
    .order("priority", { ascending: true })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingBannersTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as BannerRow[];
}

const loadCachedBannerRows = cache(async () => loadBannerRows(), ["site-banner-rows"], {
  revalidate: BANNER_CACHE_REVALIDATE_SECONDS,
  tags: [BANNER_CACHE_TAG],
});

export async function loadAdminBanners() {
  const rows = await loadCachedBannerRows();

  return rows.map(mapBannerRow);
}
