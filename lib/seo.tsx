import type { Metadata } from "next";

import { getCatalogPriceLabel, getCatalogProductPageHref, type CatalogProduct } from "@/lib/catalog";

export const siteName = "Vione Hernal";
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  "https://vionehernal.com"
).replace(/\/+$/, "");
export const defaultSeoDescription =
  "Vione Hernal is a luxury fashion house exploring minimal luxury fashion, designer streetwear, and blockchain-enabled ownership.";
export const seoKeywords = [
  "blockchain fashion",
  "luxury streetwear",
  "minimal luxury fashion",
  "web3 fashion",
  "designer streetwear Philippines",
  "Vione Hernal",
];

type SeoMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  noIndex?: boolean;
};

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createSeoMetadata({ title, description = defaultSeoDescription, path = "/", image, noIndex }: SeoMetadataInput): Metadata {
  const canonical = absoluteUrl(path);
  const resolvedTitle = title === siteName ? title : `${title} | ${siteName}`;
  const images = image ? [{ url: absoluteUrl(image), alt: title }] : undefined;

  return {
    title: resolvedTitle,
    description,
    keywords: seoKeywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title: resolvedTitle,
      description,
      url: canonical,
      siteName,
      type: "website",
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: resolvedTitle,
      description,
      images: image ? [absoluteUrl(image)] : undefined,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    email: "vionehernal@gmail.com",
    sameAs: [siteUrl],
    brand: {
      "@type": "Brand",
      name: siteName,
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productJsonLd(product: CatalogProduct) {
  const inStock = Object.values(product.sizeInventory).some((quantity) => quantity > 0);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: product.brand || siteName,
    },
    image: [absoluteUrl(product.image), ...product.galleryImages.map((image) => absoluteUrl(image))],
    description: product.description,
    category: product.categoryLabel,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(getCatalogProductPageHref(product.id)),
      priceCurrency: "PHP",
      price: (product.pricePhpCents / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function getProductSeoDescription(product: CatalogProduct) {
  return `${product.name} by ${product.brand}, ${getCatalogPriceLabel(
    product.pricePhpCents,
  )}. Minimal luxury fashion and designer streetwear from Vione Hernal with blockchain-ready ownership.`;
}
