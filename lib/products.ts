import "server-only";

import { unstable_cache as cache } from "next/cache";

import {
  CATALOG_MENS_DEPARTMENT,
  CATALOG_UNISEX_DEPARTMENT,
  CATALOG_WOMENS_DEPARTMENT,
  catalogProductMatchesDepartment,
  featuredProducts,
  getUniqueCatalogProducts,
  type CatalogProduct,
} from "@/lib/catalog";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export const PRODUCT_CACHE_TAG = "catalog-products";
const PRODUCT_CACHE_REVALIDATE_SECONDS = 30;
const PRODUCT_QUERY_TIMEOUT_MS = Number(process.env.PRODUCT_QUERY_TIMEOUT_MS?.trim() || "1200");

export const PRODUCT_DEPARTMENT_OPTIONS = [CATALOG_WOMENS_DEPARTMENT, CATALOG_MENS_DEPARTMENT, CATALOG_UNISEX_DEPARTMENT] as const;
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

  if (normalizedValue.includes("unisex") || normalizedValue.includes("both")) {
    return CATALOG_UNISEX_DEPARTMENT;
  }

  if (normalizedValue.includes("women")) {
    return CATALOG_WOMENS_DEPARTMENT;
  }

  if (normalizedValue.includes("men")) {
    return CATALOG_MENS_DEPARTMENT;
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

function getProductDepartmentFilterValues(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const department = normalizeProductDepartment(value);
  const unisexValues = [CATALOG_UNISEX_DEPARTMENT, "Unisex", "unisex", "Both", "both"];

  if (department === CATALOG_WOMENS_DEPARTMENT || department === CATALOG_MENS_DEPARTMENT) {
    const departmentValues =
      department === CATALOG_WOMENS_DEPARTMENT
        ? [CATALOG_WOMENS_DEPARTMENT, "Womens", "womens", "Women", "women"]
        : [CATALOG_MENS_DEPARTMENT, "Mens", "mens", "Men", "men"];

    return Array.from(new Set([...departmentValues, ...unisexValues]));
  }

  if (department === CATALOG_UNISEX_DEPARTMENT) {
    return Array.from(new Set(unisexValues));
  }

  return [department];
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

type ProductRowFilters = {
  featuredOnly?: boolean;
  newArrivalsOnly?: boolean;
  includeDrafts?: boolean;
  productId?: string;
  limit?: number;
  department?: string | null;
  category?: string | null;
};

type ProductQueryResult<T> =
  | {
      timedOut: false;
      value: T;
    }
  | {
      timedOut: true;
    };

async function withProductQueryTimeout<T>(promise: PromiseLike<T>): Promise<ProductQueryResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race<ProductQueryResult<T>>([
      Promise.resolve(promise).then(
        (value) =>
          ({
            timedOut: false,
            value,
          }) as const,
      ),
      new Promise<{ timedOut: true }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), PRODUCT_QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getFallbackPublishedProducts() {
  return sortByPublishedNewest(featuredProducts.filter((product) => product.status === "published"));
}

function getFallbackCatalogPage(filters: {
  offset: number;
  limit: number;
  department?: string | null;
  category?: string | null;
  newArrivalsOnly?: boolean;
}) {
  const fallbackProducts = getFallbackPublishedProducts().filter((product) => {
    const departmentMatches = filters.department ? catalogProductMatchesDepartment(product.department, filters.department) : true;
    const categoryMatches = filters.category ? product.categoryLabel === normalizeProductCategory(filters.category) : true;
    const newArrivalMatches = filters.newArrivalsOnly ? product.showInNewArrivals : true;

    return departmentMatches && categoryMatches && newArrivalMatches;
  });
  const products = fallbackProducts.slice(filters.offset, filters.offset + filters.limit);

  return {
    products,
    hasMore: filters.offset + products.length < fallbackProducts.length,
    total: fallbackProducts.length,
  };
}

async function loadProductRows(filters?: ProductRowFilters) {
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

  if (filters?.department) {
    const departmentValues = getProductDepartmentFilterValues(filters.department);
    query = departmentValues.length > 1 ? query.in("department", departmentValues) : query.eq("department", departmentValues[0]);
  }

  if (filters?.category) {
    query = query.eq("category_label", normalizeProductCategory(filters.category));
  }

  query = query.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const result = await withProductQueryTimeout(query);

  if (result.timedOut) {
    return null;
  }

  const { data, error } = result.value;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProductRow[];
}

async function loadProductRowsPage(filters: ProductRowFilters & { offset: number; limit: number }) {
  const from = Math.max(0, filters.offset);
  const limit = Math.max(1, filters.limit);
  const to = from + limit - 1;
  const admin = createSupabaseAdminClient();
  let query = admin.from("products").select("*", { count: "exact" });

  if (!filters.includeDrafts) {
    query = query.eq("status", "published");
  }

  if (filters.newArrivalsOnly) {
    query = query.eq("show_in_new_arrivals", true);
  }

  if (filters.department) {
    const departmentValues = getProductDepartmentFilterValues(filters.department);
    query = departmentValues.length > 1 ? query.in("department", departmentValues) : query.eq("department", departmentValues[0]);
  }

  if (filters.category) {
    query = query.eq("category_label", normalizeProductCategory(filters.category));
  }

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const result = await withProductQueryTimeout(query);

  if (result.timedOut) {
    return null;
  }

  const { data, error, count } = result.value;

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? from + (data?.length ?? 0);

  return {
    rows: (data || []) as ProductRow[],
    total,
    hasMore: total > to + 1,
  };
}

const loadCachedProductRows = cache(
  async (filters?: ProductRowFilters) => loadProductRows(filters),
  ["catalog-product-rows"],
  {
    revalidate: PRODUCT_CACHE_REVALIDATE_SECONDS,
    tags: [PRODUCT_CACHE_TAG],
  },
);

export async function loadPublishedCatalogProducts() {
  try {
    const rows = await loadCachedProductRows();
    if (!rows) {
      return getFallbackPublishedProducts();
    }

    return getUniqueCatalogProducts(sortByPublishedNewest(rows.map(mapProductRow)));
  } catch {
    return getFallbackPublishedProducts();
  }
}

export async function loadFeaturedCatalogProducts(limit = 3, department?: string | null) {
  try {
    const rows = await loadCachedProductRows({ featuredOnly: true, limit: Math.max(limit * 4, limit), department });
    if (!rows) {
      return [];
    }

    return getUniqueCatalogProducts(sortByPublishedNewest(rows.map(mapProductRow))).slice(0, limit);
  } catch {
    return [];
  }
}

export async function loadNewArrivalCatalogProducts() {
  try {
    const rows = await loadCachedProductRows({ newArrivalsOnly: true });
    if (!rows) {
      return sortByPublishedNewest(getFallbackPublishedProducts().filter((product) => product.showInNewArrivals));
    }

    return sortByPublishedNewest(rows.map(mapProductRow));
  } catch {
    return sortByPublishedNewest(getFallbackPublishedProducts().filter((product) => product.showInNewArrivals));
  }
}

export async function loadPublishedCatalogProductsPage(filters: {
  offset?: number;
  limit?: number;
  department?: string | null;
  category?: string | null;
  newArrivalsOnly?: boolean;
}) {
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.max(1, filters.limit ?? 20);

  try {
    const page = await loadProductRowsPage({
      offset,
      limit,
      department: filters.department,
      category: filters.category,
      newArrivalsOnly: filters.newArrivalsOnly,
    });

    if (!page) {
      return getFallbackCatalogPage({
        offset,
        limit,
        department: filters.department,
        category: filters.category,
        newArrivalsOnly: filters.newArrivalsOnly,
      });
    }

    return {
      products: getUniqueCatalogProducts(page.rows.map(mapProductRow)),
      hasMore: page.hasMore,
      total: page.total,
    };
  } catch {
    return getFallbackCatalogPage({
      offset,
      limit,
      department: filters.department,
      category: filters.category,
      newArrivalsOnly: filters.newArrivalsOnly,
    });
  }
}

export async function loadPublishedCatalogProduct(productId: string) {
  try {
    const rows = await loadCachedProductRows({ productId, limit: 1 });
    if (!rows) {
      return featuredProducts.find((fallbackProduct) => fallbackProduct.id === productId) ?? null;
    }

    return rows[0] ? mapProductRow(rows[0]) : null;
  } catch {
    return featuredProducts.find((fallbackProduct) => fallbackProduct.id === productId) ?? null;
  }
}

export async function loadAdminCatalogProducts() {
  const rows = await loadProductRows({ includeDrafts: true });
  if (!rows) {
    throw new Error("Catalog service is taking too long to respond.");
  }

  return sortByPublishedNewest(rows.map(mapProductRow));
}
