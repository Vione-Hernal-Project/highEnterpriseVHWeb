import type { MetadataRoute } from "next";

import { editorialArticles } from "@/lib/editorial";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { seoLandingPages } from "@/lib/seo-pages";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogProductPageHref } from "@/lib/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await loadPublishedCatalogProducts();
  const staticPaths = [
    "/",
    "/shop",
    "/new",
    "/women",
    "/men",
    "/bags",
    "/about",
    "/affiliate",
    "/editorial",
    ...seoLandingPages.map((page) => page.path),
    ...editorialArticles.map((article) => `/editorial/${article.slug}`),
  ];

  return [
    ...staticPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(getCatalogProductPageHref(product.id)),
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
