import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  description: string;
  pricePhpCents: number;
  image: string;
  hoverImage: string;
  categoryLabel: string;
  department: string;
  sizes: string[];
  sizeInventory: Record<string, number>;
  galleryImages: string[];
  status: "draft" | "published";
  showInFeatured: boolean;
  showInNewArrivals: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CatalogProductUiMeta = Pick<CatalogProduct, "categoryLabel" | "department" | "sizes">;

export const CATALOG_WOMENS_DEPARTMENT = "Womens";
export const CATALOG_MENS_DEPARTMENT = "Mens";
export const CATALOG_UNISEX_DEPARTMENT = "Unisex";

export function normalizeCatalogDepartment(value: string | null | undefined) {
  const normalizedValue = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalizedValue) {
    return "";
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

  return value?.trim() || "";
}

export function catalogProductMatchesDepartment(productDepartment: string | null | undefined, targetDepartment: string | null | undefined) {
  const target = normalizeCatalogDepartment(targetDepartment);

  if (!target) {
    return true;
  }

  const product = normalizeCatalogDepartment(productDepartment);

  if (
    product === CATALOG_UNISEX_DEPARTMENT &&
    (target === CATALOG_WOMENS_DEPARTMENT || target === CATALOG_MENS_DEPARTMENT)
  ) {
    return true;
  }

  return product === target;
}

function normalizeCatalogProductDedupeValue(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getCatalogProductDedupeKey(product: CatalogProduct) {
  return [
    normalizeCatalogProductDedupeValue(product.name),
    normalizeCatalogProductDedupeValue(product.image),
    normalizeCatalogProductDedupeValue(product.pricePhpCents),
  ].join("|");
}

export function getUniqueCatalogProducts(products: CatalogProduct[]) {
  const seenProductIds = new Set<string>();
  const seenProductKeys = new Set<string>();

  return products.filter((product) => {
    const productKey = getCatalogProductDedupeKey(product);

    if (seenProductIds.has(product.id) || seenProductKeys.has(productKey)) {
      return false;
    }

    seenProductIds.add(product.id);
    seenProductKeys.add(productKey);
    return true;
  });
}

export const featuredProducts: CatalogProduct[] = [
  {
    id: "MIUF-WZ238",
    name: "Maison Mary Jane Flat",
    brand: "VIONE HERNAL",
    description: "Glossed leather lines with an editorial finish for day-to-night dressing.",
    pricePhpCents: 50000,
    image: "/assets/images/maryjaneshoe.png",
    hoverImage: "/assets/images/maryjaneshoe.png",
    categoryLabel: "Shoes",
    department: "Womens",
    sizes: ["36", "37", "38", "39"],
    sizeInventory: {
      "36": 5,
      "37": 4,
      "38": 4,
      "39": 3,
    },
    galleryImages: [],
    status: "published",
    showInFeatured: true,
    showInNewArrivals: true,
    publishedAt: "2026-04-10T00:00:00.000Z",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "BOFE-WS139",
    name: "Sheer Layered Co-Ord Set",
    brand: "VIONE HERNAL",
    description: "Layered tailoring with a softened structure that keeps the silhouette refined.",
    pricePhpCents: 150000,
    image: "/assets/images/SheerLayeredCo-OrdSet-1.png",
    hoverImage: "/assets/images/SheerLayeredCo-OrdSet.png",
    categoryLabel: "Ready to Wear",
    department: "Womens",
    sizes: ["XS", "S", "M", "L"],
    sizeInventory: {
      XS: 5,
      S: 4,
      M: 3,
      L: 2,
    },
    galleryImages: [],
    status: "published",
    showInFeatured: true,
    showInNewArrivals: true,
    publishedAt: "2026-04-11T00:00:00.000Z",
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
  },
  {
    id: "BOFE-WY20",
    name: "Rose Tweed Top Handle Bag",
    brand: "VIONE HERNAL",
    description: "A statement carryall shaped with couture texture and a polished top-handle profile.",
    pricePhpCents: 200000,
    image: "/assets/images/RoseTweedTopHandleBag.png",
    hoverImage: "/assets/images/RoseTweedTopHandleBag-1.png",
    categoryLabel: "Bags",
    department: "Womens",
    sizes: ["One Size"],
    sizeInventory: {
      "One Size": 4,
    },
    galleryImages: [],
    status: "published",
    showInFeatured: true,
    showInNewArrivals: true,
    publishedAt: "2026-04-12T00:00:00.000Z",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
  },
];

function resolveFallbackProduct(productOrId: CatalogProduct | string | null | undefined) {
  if (!productOrId) {
    return null;
  }

  if (typeof productOrId === "string") {
    return featuredProducts.find((product) => product.id === productOrId) ?? null;
  }

  return productOrId;
}

export function getProductAvailableSizes(product: CatalogProduct | null | undefined) {
  if (!product) {
    return ["One Size"];
  }

  const inStockSizes = product.sizes.filter((size) => (product.sizeInventory[size] ?? 0) > 0);

  return inStockSizes.length ? inStockSizes : product.sizes.length ? product.sizes : ["One Size"];
}

export function getCatalogProduct(productId: string | null | undefined) {
  if (!productId) {
    return null;
  }

  return featuredProducts.find((product) => product.id === productId) ?? null;
}

export function getCatalogSubtotalPhpCents(pricePhpCents: number, quantity: number) {
  return pricePhpCents * quantity;
}

export function getCatalogPriceLabel(pricePhpCents: number) {
  return formatPhpCurrencyFromCents(pricePhpCents);
}

export function getCatalogProductUiMeta(productOrId: CatalogProduct | string | null | undefined): CatalogProductUiMeta {
  const product = resolveFallbackProduct(productOrId);

  if (product) {
    return {
      categoryLabel: product.categoryLabel,
      department: product.department,
      sizes: getProductAvailableSizes(product),
    };
  }

  return {
    categoryLabel: "Collection",
    department: "Womens",
    sizes: ["One Size"],
  };
}

export function getCatalogProductPageHref(productId: string) {
  return `/product/${encodeURIComponent(productId)}`;
}
