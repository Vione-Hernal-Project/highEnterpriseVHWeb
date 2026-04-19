import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { featuredProducts, type CatalogProduct } from "@/lib/catalog";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export const PRODUCT_DEPARTMENT_OPTIONS = ["Womens"] as const;
export const PRODUCT_CATEGORY_OPTIONS = ["Ready to Wear", "Tops", "Shoes", "Bags", "Accessories"] as const;

function normalizeFilterToken(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeProductDepartment(value: string | null | undefined) {
  const normalizedValue = normalizeFilterToken(value);

  if (!normalizedValue) {
    return PRODUCT_DEPARTMENT_OPTIONS[0];
  }

  if (normalizedValue.includes("women")) {
    return "Womens";
  }

  return toTitleCase(value || PRODUCT_DEPARTMENT_OPTIONS[0]);
}

export function normalizeProductCategory(value: string | null | undefined) {
  const normalizedValue = normalizeFilterToken(value);

  if (!normalizedValue) {
    return "Ready to Wear";
  }

  if (normalizedValue.includes("shoe")) {
    return "Shoes";
  }

  if (normalizedValue.includes("bag")) {
    return "Bags";
  }

  if (normalizedValue.includes("top")) {
    return "Tops";
  }

  if (
    normalizedValue.includes("ready to wear") ||
    normalizedValue.includes("readywear") ||
    normalizedValue.includes("dress") ||
    normalizedValue.includes("clothing") ||
    normalizedValue.includes("co ord") ||
    normalizedValue.includes("coord") ||
    normalizedValue.includes("set")
  ) {
    return "Ready to Wear";
  }

  if (normalizedValue.includes("accessor")) {
    return "Accessories";
  }

  return toTitleCase(value || "Ready to Wear");
}

export function getProductFilterSlug(value: string | null | undefined) {
  return normalizeFilterToken(value).replace(/\s+/g, "-");
}

export function resolveDepartmentFilter(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return normalizeProductDepartment(value.replace(/-/g, " "));
}

export function resolveCategoryFilter(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return normalizeProductCategory(value.replace(/-/g, " "));
}

function parseStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseSizeInventory(value: Json | null | undefined) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {} as Record<string, number>;
  }

  return Object.entries(value).reduce<Record<string, number>>((inventory, [size, quantity]) => {
    const parsedQuantity = Number(quantity);

    if (!size.trim() || !Number.isFinite(parsedQuantity)) {
      return inventory;
    }

    inventory[size] = Math.max(0, Math.floor(parsedQuantity));
    return inventory;
  }, {});
}

function mapProductRow(row: ProductRow): CatalogProduct {
  const sizeInventory = parseSizeInventory(row.size_inventory);
  const sizes = Object.keys(sizeInventory);

  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description,
    pricePhpCents: row.price_php_cents,
    image: row.main_image_url,
    hoverImage: row.hover_image_url || row.main_image_url,
    categoryLabel: normalizeProductCategory(row.category_label),
    department: normalizeProductDepartment(row.department),
    sizes: sizes.length ? sizes : ["One Size"],
    sizeInventory,
    galleryImages: parseStringArray(row.gallery_image_urls),
    status: row.status === "published" ? "published" : "draft",
    showInFeatured: row.show_in_featured,
    showInNewArrivals: row.show_in_new_arrivals,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortByPublishedNewest(products: CatalogProduct[]) {
  return [...products].sort((left, right) => {
    const leftTimestamp = Date.parse(left.publishedAt || left.createdAt || "1970-01-01T00:00:00.000Z");
    const rightTimestamp = Date.parse(right.publishedAt || right.createdAt || "1970-01-01T00:00:00.000Z");

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return right.id.localeCompare(left.id);
  });
}

async function loadProductRows(filters?: {
  featuredOnly?: boolean;
  newArrivalsOnly?: boolean;
  includeDrafts?: boolean;
  productId?: string;
  limit?: number;
}) {
  noStore();

  const admin = createSupabaseAdminClient();
  let query = admin.from("products").select("*");

  if (filters?.productId) {
    query = query.eq("id", filters.productId);
  }

  if (!filters?.includeDrafts) {
    query = query.eq("status", "published");
  }

  if (filters?.featuredOnly) {
    query = query.eq("show_in_featured", true);
  }

  if (filters?.newArrivalsOnly) {
    query = query.eq("show_in_new_arrivals", true);
  }

  query = query.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProductRow[];
}

function getFallbackPublishedProducts() {
  return sortByPublishedNewest(featuredProducts.filter((product) => product.status === "published"));
}

export async function loadPublishedCatalogProducts() {
  try {
    const rows = await loadProductRows();
    return sortByPublishedNewest(rows.map(mapProductRow));
  } catch {
    return getFallbackPublishedProducts();
  }
}

export async function loadFeaturedCatalogProducts(limit = 3) {
  try {
    const rows = await loadProductRows({ featuredOnly: true, limit });
    return sortByPublishedNewest(rows.map(mapProductRow)).slice(0, limit);
  } catch {
    return sortByPublishedNewest(getFallbackPublishedProducts().filter((product) => product.showInFeatured)).slice(0, limit);
  }
}

export async function loadNewArrivalCatalogProducts() {
  try {
    const rows = await loadProductRows({ newArrivalsOnly: true });
    return sortByPublishedNewest(rows.map(mapProductRow));
  } catch {
    return sortByPublishedNewest(getFallbackPublishedProducts().filter((product) => product.showInNewArrivals));
  }
}

export async function loadPublishedCatalogProduct(productId: string) {
  try {
    const rows = await loadProductRows({ productId, limit: 1 });
    return rows[0] ? mapProductRow(rows[0]) : null;
  } catch {
    return featuredProducts.find((fallbackProduct) => fallbackProduct.id === productId) ?? null;
  }
}

export async function loadAdminCatalogProducts() {
  const rows = await loadProductRows({ includeDrafts: true });

  return sortByPublishedNewest(rows.map(mapProductRow));
}
