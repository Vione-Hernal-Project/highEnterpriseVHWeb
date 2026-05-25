import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getCurrentUserContext } from "@/lib/auth";
import { COLLECTION_CACHE_TAG, isMissingCollectionsTableError, loadAdminCollectionRecords } from "@/lib/collections";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { PRODUCT_CACHE_TAG } from "@/lib/products";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCollectionSchema } from "@/lib/validations/collection";

const ADMIN_COLLECTION_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_COLLECTION_WRITE_LIMIT = 60;
const ADMIN_COLLECTION_BODY_LIMIT_BYTES = 64 * 1024;

function buildCollectionPayload(input: ReturnType<typeof adminCollectionSchema.parse>) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    image_url: input.imageUrl,
    status: input.status,
    collection_type: input.collectionType,
    display_order: input.displayOrder,
    is_featured: input.isFeatured,
    featured_from: input.featuredFrom,
    featured_until: input.featuredUntil,
    meta_title: input.metaTitle,
    meta_description: input.metaDescription,
  };
}

function getCollectionStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Collection storage is not installed yet. Apply the updated Supabase schema so Add Collection can save real collection records.",
    },
    { status: 501 },
  );
}

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const collections = await loadAdminCollectionRecords();

    return NextResponse.json({ collections });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load collections right now.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_COLLECTION_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:collections:write:user:${user.id}`,
      limit: ADMIN_COLLECTION_WRITE_LIMIT,
      windowMs: ADMIN_COLLECTION_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many collection update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminCollectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid collection payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("collections")
      .insert(buildCollectionPayload(parsed.data))
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingCollectionsTableError(new Error(error.message))) {
        return getCollectionStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A collection with this slug already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to save the collection right now." }, { status: 500 });
    }

    revalidateTag(COLLECTION_CACHE_TAG, { expire: 0 });
    revalidateTag(PRODUCT_CACHE_TAG, { expire: 0 });

    return NextResponse.json({ collection: data });
  } catch (error) {
    if (isMissingCollectionsTableError(error)) {
      return getCollectionStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the collection right now.") }, { status: 500 });
  }
}
