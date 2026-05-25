import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { CatalogProduct } from "@/lib/catalog";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];

export const COLLECTION_CACHE_TAG = "catalog-collections";
const COLLECTION_CACHE_REVALIDATE_SECONDS = 30;

export type AdminCollectionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  status: string;
  collectionType: "manual" | "automatic";
  displayOrder: number;
  isFeatured: boolean;
  featuredFrom: string | null;
  featuredUntil: string | null;
  metaTitle: string;
  metaDescription: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminCollectionOption = {
  name: string;
  slug: string;
  status: string;
};

export function normalizeCollectionSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCollectionKey(value: string) {
  return normalizeCollectionSlug(value);
}

export function isMissingCollectionsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.collections\" does not exist") || message.includes("schema cache");
}

function mapCollectionRow(row: CollectionRow): AdminCollectionRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    imageUrl: row.image_url,
    status: row.status || "draft",
    collectionType: row.collection_type === "automatic" ? "automatic" : "manual",
    displayOrder: row.display_order,
    isFeatured: row.is_featured,
    featuredFrom: row.featured_from,
    featuredUntil: row.featured_until,
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadCollectionRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("collections")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingCollectionsTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as CollectionRow[];
}

const loadCachedCollectionRows = cache(async () => loadCollectionRows(), ["catalog-collection-rows"], {
  revalidate: COLLECTION_CACHE_REVALIDATE_SECONDS,
  tags: [COLLECTION_CACHE_TAG],
});

export async function loadAdminCollectionRecords() {
  const rows = await loadCachedCollectionRows();

  return rows.map(mapCollectionRow);
}

export function getCollectionNamesFromProducts(products: CatalogProduct[]) {
  return Array.from(
    new Set(
      products
        .map((product) => product.categoryLabel.trim())
        .filter((category) => category && category.toLowerCase() !== "collection" && category.toLowerCase() !== "uncategorized"),
    ),
  ).sort((first, second) => first.localeCompare(second));
}

export function buildAdminCollectionOptions(collections: AdminCollectionRecord[], products: CatalogProduct[]): AdminCollectionOption[] {
  const optionMap = new Map<string, AdminCollectionOption>();

  collections.forEach((collection) => {
    optionMap.set(normalizeCollectionKey(collection.name), {
      name: collection.name,
      slug: collection.slug,
      status: collection.status,
    });
  });

  getCollectionNamesFromProducts(products).forEach((name) => {
    const key = normalizeCollectionKey(name);

    if (!optionMap.has(key)) {
      optionMap.set(key, {
        name,
        slug: normalizeCollectionSlug(name),
        status: "active",
      });
    }
  });

  return [...optionMap.values()].sort((first, second) => first.name.localeCompare(second.name));
}
