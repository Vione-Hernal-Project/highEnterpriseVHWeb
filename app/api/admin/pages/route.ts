import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { isMissingSitePagesTableError, SITE_PAGE_CACHE_TAG, staticSitePages } from "@/lib/site-pages";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminSitePageSchema } from "@/lib/validations/site-page";

const ADMIN_PAGE_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_PAGE_WRITE_LIMIT = 60;
const ADMIN_PAGE_BODY_LIMIT_BYTES = 160 * 1024;

function buildSitePagePayload(input: ReturnType<typeof adminSitePageSchema.parse>) {
  return {
    title: input.title,
    slug: input.slug,
    page_type: input.pageType,
    parent_page_id: input.parentPageId,
    meta_description: input.metaDescription,
    content: input.content,
    featured_image_url: input.featuredImageUrl,
    status: input.status,
    visibility: input.visibility,
    template: input.template,
    show_in_navigation: input.showInNavigation,
    display_order: input.displayOrder,
    meta_title: input.metaTitle,
    meta_keywords: input.metaKeywords,
  };
}

function getSitePageStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Page storage is not installed yet. Apply the updated Supabase schema so Add New Page can save records.",
    },
    { status: 501 },
  );
}

async function requirePageWriteAccess() {
  const { user, role } = await getCurrentUserContext();

  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  if (!hasAdminAccess(role, "content")) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  const userRateLimit = await applyRateLimit({
    key: `admin:pages:write:user:${user.id}`,
    limit: ADMIN_PAGE_WRITE_LIMIT,
    windowMs: ADMIN_PAGE_WRITE_WINDOW_MS,
  });

  if (!userRateLimit.allowed) {
    return {
      error: NextResponse.json(
        { error: "Too many page update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      ),
    };
  }

  return { user };
}

export async function POST(request: Request) {
  try {
    const bodySizeError = getJsonBodySizeError(request, ADMIN_PAGE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const access = await requirePageWriteAccess();

    if ("error" in access) {
      return access.error;
    }

    const body = await request.json().catch(() => null);
    const parsed = adminSitePageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid page payload." }, { status: 400 });
    }

    if (staticSitePages.some((page) => page.slug && page.slug === parsed.data.slug)) {
      return NextResponse.json({ error: "This slug is already used by an existing application route." }, { status: 409 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("site_pages").insert(buildSitePagePayload(parsed.data)).select("*").single();

    if (error || !data) {
      if (error && isMissingSitePagesTableError(new Error(error.message))) {
        return getSitePageStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A page with this slug already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to save the page right now." }, { status: 500 });
    }

    revalidateTag(SITE_PAGE_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/pages");
    revalidatePath(`/${data.slug}`);

    return NextResponse.json({ page: data });
  } catch (error) {
    if (isMissingSitePagesTableError(error)) {
      return getSitePageStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the page right now.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const bodySizeError = getJsonBodySizeError(request, ADMIN_PAGE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const access = await requirePageWriteAccess();

    if ("error" in access) {
      return access.error;
    }

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const parsed = adminSitePageSchema.safeParse(body);

    if (!id) {
      return NextResponse.json({ error: "Page id is required." }, { status: 400 });
    }

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid page payload." }, { status: 400 });
    }

    if (staticSitePages.some((page) => page.slug && page.slug === parsed.data.slug)) {
      return NextResponse.json({ error: "This slug is already used by an existing application route." }, { status: 409 });
    }

    const admin = createSupabaseAdminClient();
    const { data: currentPage, error: currentError } = await admin.from("site_pages").select("slug").eq("id", id).maybeSingle();

    if (currentError) {
      if (isMissingSitePagesTableError(new Error(currentError.message))) {
        return getSitePageStorageErrorResponse();
      }

      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    if (!currentPage) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const { data, error } = await admin.from("site_pages").update(buildSitePagePayload(parsed.data)).eq("id", id).select("*").single();

    if (error || !data) {
      if (error && isMissingSitePagesTableError(new Error(error.message))) {
        return getSitePageStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A page with this slug already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to update the page right now." }, { status: 500 });
    }

    revalidateTag(SITE_PAGE_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/pages");
    revalidatePath(`/${currentPage.slug}`);
    revalidatePath(`/${data.slug}`);

    return NextResponse.json({ page: data });
  } catch (error) {
    if (isMissingSitePagesTableError(error)) {
      return getSitePageStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the page right now.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requirePageWriteAccess();

    if ("error" in access) {
      return access.error;
    }

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "Page id is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("site_pages").delete().eq("id", id).select("slug").maybeSingle();

    if (error) {
      if (isMissingSitePagesTableError(new Error(error.message))) {
        return getSitePageStorageErrorResponse();
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    revalidateTag(SITE_PAGE_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/pages");
    revalidatePath(`/${data.slug}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingSitePagesTableError(error)) {
      return getSitePageStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to delete the page right now.") }, { status: 500 });
  }
}
