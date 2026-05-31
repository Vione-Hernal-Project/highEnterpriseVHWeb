import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { BLOG_CACHE_TAG, isMissingBlogPostsTableError } from "@/lib/blog";
import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminBlogPostSchema } from "@/lib/validations/blog";

const ADMIN_BLOG_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_BLOG_WRITE_LIMIT = 60;
const ADMIN_BLOG_BODY_LIMIT_BYTES = 160 * 1024;

function buildBlogPostPayload(input: ReturnType<typeof adminBlogPostSchema.parse>) {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    featured_image_url: input.featuredImageUrl,
    content: input.content,
    status: input.status,
    visibility: input.visibility,
    categories: input.categories,
    tags: input.tags,
    author_name: input.authorName,
    publish_at: input.publishAt,
    meta_title: input.metaTitle,
    meta_description: input.metaDescription,
  };
}

function getBlogStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Blog storage is not installed yet. Apply the updated Supabase schema so Add New Post can save real editorial records.",
    },
    { status: 501 },
  );
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "content")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_BLOG_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:blog:write:user:${user.id}`,
      limit: ADMIN_BLOG_WRITE_LIMIT,
      windowMs: ADMIN_BLOG_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many blog update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid blog post payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .insert(buildBlogPostPayload(parsed.data))
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingBlogPostsTableError(new Error(error.message))) {
        return getBlogStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A blog post with this slug already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to save the blog post right now." }, { status: 500 });
    }

    revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/blog");
    revalidatePath("/editorial");
    revalidatePath(`/editorial/${data.slug}`);

    return NextResponse.json({ post: data });
  } catch (error) {
    if (isMissingBlogPostsTableError(error)) {
      return getBlogStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the blog post right now.") }, { status: 500 });
  }
}
