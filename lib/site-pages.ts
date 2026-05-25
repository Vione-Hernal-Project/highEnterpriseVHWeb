import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SitePageRow = Database["public"]["Tables"]["site_pages"]["Row"];

export const SITE_PAGE_CACHE_TAG = "site-pages";
const SITE_PAGE_CACHE_REVALIDATE_SECONDS = 30;

export type SitePageStatus = "published" | "draft" | "archived";
export type SitePageVisibility = "public" | "private" | "password";

export type SitePageRecord = {
  id: string;
  title: string;
  slug: string;
  href: string;
  pageType: string;
  parentPageId: string | null;
  metaDescription: string;
  content: string;
  featuredImageUrl: string | null;
  status: SitePageStatus;
  visibility: SitePageVisibility;
  template: string;
  showInNavigation: boolean;
  displayOrder: number;
  metaTitle: string;
  metaKeywords: string;
  createdAt: string;
  updatedAt: string;
  source: "cms" | "static";
};

export const staticSitePages: SitePageRecord[] = [
  { id: "static:/", title: "Home", slug: "", href: "/", pageType: "Custom Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Default Template", showInNavigation: true, displayOrder: 0, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/shop", title: "Shop", slug: "shop", href: "/shop", pageType: "Shop Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Shop Template", showInNavigation: true, displayOrder: 1, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/about", title: "About Us", slug: "about", href: "/about", pageType: "Custom Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Default Template", showInNavigation: true, displayOrder: 2, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/affiliate", title: "Affiliate", slug: "affiliate", href: "/affiliate", pageType: "Custom Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Default Template", showInNavigation: true, displayOrder: 3, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/wishlist", title: "Wishlist", slug: "wishlist", href: "/wishlist", pageType: "Customer Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Customer Template", showInNavigation: false, displayOrder: 4, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/bag", title: "Bag", slug: "bag", href: "/bag", pageType: "Checkout Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Checkout Template", showInNavigation: false, displayOrder: 5, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/sign-in", title: "Sign In", slug: "sign-in", href: "/sign-in", pageType: "Auth Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Auth Template", showInNavigation: false, displayOrder: 6, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
  { id: "static:/sign-up", title: "Sign Up", slug: "sign-up", href: "/sign-up", pageType: "Auth Page", parentPageId: null, metaDescription: "", content: "", featuredImageUrl: null, status: "published", visibility: "public", template: "Auth Template", showInNavigation: false, displayOrder: 7, metaTitle: "", metaKeywords: "", createdAt: "", updatedAt: "", source: "static" },
];

export function normalizeSitePageSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isMissingSitePagesTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.site_pages\" does not exist") || message.includes("schema cache");
}

function normalizeStatus(value: string): SitePageStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function normalizeVisibility(value: string): SitePageVisibility {
  return value === "private" || value === "password" ? value : "public";
}

function getSitePageHref(slug: string) {
  return `/${slug}`;
}

function mapSitePageRow(row: SitePageRow): SitePageRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    href: getSitePageHref(row.slug),
    pageType: row.page_type || "Custom Page",
    parentPageId: row.parent_page_id,
    metaDescription: row.meta_description || "",
    content: row.content || "",
    featuredImageUrl: row.featured_image_url,
    status: normalizeStatus(row.status),
    visibility: normalizeVisibility(row.visibility),
    template: row.template || "Default Template",
    showInNavigation: row.show_in_navigation,
    displayOrder: row.display_order,
    metaTitle: row.meta_title || "",
    metaKeywords: row.meta_keywords || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "cms",
  };
}

async function loadSitePageRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("site_pages")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingSitePagesTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as SitePageRow[];
}

const loadCachedSitePageRows = cache(async () => loadSitePageRows(), ["site-page-rows"], {
  revalidate: SITE_PAGE_CACHE_REVALIDATE_SECONDS,
  tags: [SITE_PAGE_CACHE_TAG],
});

export async function loadAdminSitePages() {
  const rows = await loadCachedSitePageRows();

  return rows.map(mapSitePageRow);
}

export async function loadPublishedSitePageBySlug(slug: string) {
  const normalizedSlug = normalizeSitePageSlug(slug);
  const now = Date.now();
  const pages = (await loadAdminSitePages()).filter((page) => page.status === "published" && page.visibility === "public");

  return pages.find((page) => page.slug === normalizedSlug && Date.parse(page.createdAt || new Date().toISOString()) <= now) ?? null;
}

export async function loadAdminSitePageOptions() {
  const cmsPages = await loadAdminSitePages();

  return cmsPages.map((page) => ({ id: page.id, title: page.title, href: page.href }));
}
