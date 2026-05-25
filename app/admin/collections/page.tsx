import { AdminCollectionsView, type AdminCollectionRow } from "@/components/admin/admin-collections-view";
import { requireManagementUser } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { loadAdminCollectionRecords, normalizeCollectionKey } from "@/lib/collections";
import { loadAdminCatalogProducts } from "@/lib/products";

type Props = {
  searchParams?: Promise<{
    tab?: string | string[];
    status?: string | string[];
  }>;
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalize(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveInitialTab(value: string | string[] | undefined): "All Collections" | "Featured Collections" {
  return normalize(getFirstParam(value)) === "featured collections" ? "Featured Collections" : "All Collections";
}

function resolveInitialStatusFilter(value: string | string[] | undefined): "all" | "active" | "draft" | "archived" | "disabled" {
  const normalizedValue = normalize(getFirstParam(value));

  if (normalizedValue === "active" || normalizedValue === "draft" || normalizedValue === "archived" || normalizedValue === "disabled") {
    return normalizedValue;
  }

  return "all";
}

function isUncategorizedProduct(product: CatalogProduct) {
  const category = product.categoryLabel.trim().toLowerCase();
  return !category || category === "uncategorized" || category === "collection";
}

function getCollectionTimestamp(products: CatalogProduct[], key: "createdAt" | "updatedAt") {
  const timestamps = products
    .map((product) => product[key])
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);

  if (!timestamps.length) {
    return null;
  }

  const timestamp = key === "createdAt" ? Math.min(...timestamps) : Math.max(...timestamps);
  return new Date(timestamp).toISOString();
}

function formatAssignedProductsCopy(count: number) {
  return `${count} product${count === 1 ? "" : "s"} assigned to this collection.`;
}

function resolveCollectionDescription(savedDescription: string | undefined, productCount: number) {
  const description = (savedDescription || "").trim();

  if (!description || /^\d+\s+products?\s+assigned\s+to\s+this\s+collection\.$/i.test(description)) {
    return formatAssignedProductsCopy(productCount);
  }

  return description;
}

export default async function AdminCollectionsPage({ searchParams }: Props) {
  await requireManagementUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const products = await loadAdminCatalogProducts().catch(() => []);
  const savedCollections = await loadAdminCollectionRecords().catch(() => []);
  const categorizedProducts = products.filter((product) => !isUncategorizedProduct(product));
  const uncategorizedProductCount = products.length - categorizedProducts.length;
  const collectionMap = categorizedProducts.reduce<Map<string, typeof categorizedProducts>>((map, product) => {
    const key = normalizeCollectionKey(product.categoryLabel);
    const current = map.get(key) || [];
    current.push(product);
    map.set(key, current);
    return map;
  }, new Map());
  const productCollectionNames = new Map(
    [...collectionMap.entries()].map(([key, collectionProducts]) => [key, collectionProducts[0]?.categoryLabel || key]),
  );
  const savedCollectionMap = new Map(savedCollections.map((collection) => [normalizeCollectionKey(collection.name), collection]));
  const collectionKeys = Array.from(new Set([...savedCollectionMap.keys(), ...collectionMap.keys()]));
  const collections: AdminCollectionRow[] = collectionKeys.map((collectionKey) => {
    const savedCollection = savedCollectionMap.get(collectionKey) ?? null;
    const collectionProducts = collectionMap.get(collectionKey) || [];
    const collection = savedCollection?.name || productCollectionNames.get(collectionKey) || collectionKey;
    const categoryType = collection === "Ready to Wear" ? "edited" : "catalog";
    const featuredProductCount = collectionProducts.filter((product) => product.status === "published" && product.showInFeatured).length;

    return {
      id: savedCollection?.id || collection,
      name: collection,
      description: resolveCollectionDescription(savedCollection?.description, collectionProducts.length),
      productCount: collectionProducts.length,
      status: savedCollection?.status || "active",
      featured: Boolean(savedCollection?.isFeatured) || featuredProductCount > 0,
      featuredProductCount,
      categoryType,
      categoryTypeLabel: categoryType === "edited" ? "Edited fashion category" : "Catalog collection",
      image: savedCollection?.imageUrl || collectionProducts[0]?.image || "/assets/images/vh-logo-v2.jpg",
      href: `/admin/collections/${encodeURIComponent(savedCollection?.slug || collection)}`,
      createdAt: savedCollection?.createdAt || getCollectionTimestamp(collectionProducts, "createdAt"),
      updatedAt: savedCollection?.updatedAt || getCollectionTimestamp(collectionProducts, "updatedAt"),
    };
  });

  return (
    <AdminCollectionsView
      collections={collections}
      productCount={categorizedProducts.length}
      uncategorizedProductCount={uncategorizedProductCount}
      initialTab={resolveInitialTab(resolvedSearchParams.tab)}
      initialStatusFilter={resolveInitialStatusFilter(resolvedSearchParams.status)}
    />
  );
}
