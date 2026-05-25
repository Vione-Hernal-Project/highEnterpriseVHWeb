import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database } from "@/lib/database.types";
import { editorialArticles } from "@/lib/editorial";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];

export const BLOG_CACHE_TAG = "blog-posts";
const BLOG_CACHE_REVALIDATE_SECONDS = 30;

export type BlogPostStatus = "published" | "draft" | "archived";
export type BlogPostVisibility = "public" | "private" | "password";

export type BlogPostRecord = {
  id: string;
  title: string;
  slug: string;
  href: string;
  excerpt: string;
  featuredImageUrl: string | null;
  content: string;
  status: BlogPostStatus;
  visibility: BlogPostVisibility;
  categories: string[];
  tags: string[];
  authorName: string;
  publishAt: string | null;
  metaTitle: string;
  metaDescription: string;
  createdAt: string;
  updatedAt: string;
  source: "cms" | "static";
};

export function normalizeBlogSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isMissingBlogPostsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.blog_posts\" does not exist") || message.includes("schema cache");
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)),
  );
}

function normalizeStatus(value: string): BlogPostStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function normalizeVisibility(value: string): BlogPostVisibility {
  return value === "private" || value === "password" ? value : "public";
}

function getBlogHref(slug: string) {
  return `/editorial/${slug}`;
}

function mapBlogPostRow(row: BlogPostRow): BlogPostRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    href: getBlogHref(row.slug),
    excerpt: row.excerpt || "",
    featuredImageUrl: row.featured_image_url,
    content: row.content || "",
    status: normalizeStatus(row.status),
    visibility: normalizeVisibility(row.visibility),
    categories: toStringArray(row.categories),
    tags: toStringArray(row.tags),
    authorName: row.author_name || "Admin",
    publishAt: row.publish_at,
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "cms",
  };
}

async function loadBlogPostRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("blog_posts").select("*").order("created_at", { ascending: false });

  if (error) {
    if (isMissingBlogPostsTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as BlogPostRow[];
}

const loadCachedBlogPostRows = cache(async () => loadBlogPostRows(), ["blog-post-rows"], {
  revalidate: BLOG_CACHE_REVALIDATE_SECONDS,
  tags: [BLOG_CACHE_TAG],
});

export function getStaticBlogPosts(): BlogPostRecord[] {
  return editorialArticles.map((article) => ({
    id: `static:${article.slug}`,
    title: article.title,
    slug: article.slug,
    href: getBlogHref(article.slug),
    excerpt: article.description,
    featuredImageUrl: null,
    content: article.sections.map((section) => section.body.join("\n\n")).join("\n\n"),
    status: "published",
    visibility: "public",
    categories: [article.eyebrow],
    tags: article.relatedLinks.map((link) => link.label),
    authorName: "Admin",
    publishAt: article.publishedAt,
    metaTitle: article.title,
    metaDescription: article.description,
    createdAt: article.publishedAt,
    updatedAt: article.publishedAt,
    source: "static",
  }));
}

export async function loadAdminBlogPosts() {
  const rows = await loadCachedBlogPostRows();

  return rows.map(mapBlogPostRow);
}

export async function loadPublishedBlogPosts() {
  const now = Date.now();
  const rows = await loadCachedBlogPostRows();

  return rows
    .map(mapBlogPostRow)
    .filter((post) => post.status === "published" && post.visibility === "public")
    .filter((post) => !post.publishAt || new Date(post.publishAt).getTime() <= now);
}

export async function loadPublishedBlogPostBySlug(slug: string) {
  const normalizedSlug = normalizeBlogSlug(slug);
  const posts = await loadPublishedBlogPosts();

  return posts.find((post) => post.slug === normalizedSlug) ?? null;
}

export async function loadAdminBlogTaxonomy() {
  const cmsPosts = await loadAdminBlogPosts();
  const posts = [...cmsPosts, ...getStaticBlogPosts()];
  const categories = Array.from(new Set(posts.flatMap((post) => post.categories))).sort((first, second) => first.localeCompare(second));
  const tags = Array.from(new Set(posts.flatMap((post) => post.tags))).sort((first, second) => first.localeCompare(second));

  return { categories, tags };
}
