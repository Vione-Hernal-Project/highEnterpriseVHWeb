import type { MetadataRoute } from "next";

import { loadPublishedBlogPosts } from "@/lib/blog";
import { editorialArticles } from "@/lib/editorial";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { seoLandingPages } from "@/lib/seo-pages";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogProductPageHref } from "@/lib/catalog";
import { loadAdminSitePages } from "@/lib/site-pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await loadPublishedCatalogProducts();
  const blogPosts = await loadPublishedBlogPosts();
  const cmsPages = (await loadAdminSitePages()).filter((page) => page.status === "published" && page.visibility === "public");
  const blogSlugs = new Set(blogPosts.map((post) => post.slug));
  const cmsPageHrefs = new Set(cmsPages.map((page) => page.href));
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
    ...editorialArticles.filter((article) => !blogSlugs.has(article.slug)).map((article) => `/editorial/${article.slug}`),
  ].filter((path) => !cmsPageHrefs.has(path));

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
    ...blogPosts.map((post) => ({
      url: absoluteUrl(post.href),
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...cmsPages.map((page) => ({
      url: absoluteUrl(page.href),
      lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
