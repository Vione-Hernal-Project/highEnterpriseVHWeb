import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { normalizeCollectionSlug } from "@/lib/collections";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { isMediaUploadValidationError, verifyRasterImageUpload } from "@/lib/security/media-upload";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_COLLECTION_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_COLLECTION_MEDIA_REQUEST_BYTES = 12 * 1024 * 1024;
const COLLECTION_MEDIA_UPLOAD_WINDOW_MS = 10 * 60_000;
const COLLECTION_MEDIA_UPLOAD_LIMIT = 40;

function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "collections")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, MAX_COLLECTION_MEDIA_REQUEST_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:collections:upload:user:${user.id}`,
      limit: COLLECTION_MEDIA_UPLOAD_LIMIT,
      windowMs: COLLECTION_MEDIA_UPLOAD_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many collection media uploads were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const collectionSlug = sanitizePathSegment(normalizeCollectionSlug(String(formData.get("slug") || "")));

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }

    if (file.size > MAX_COLLECTION_MEDIA_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
    }

    if (!collectionSlug) {
      return NextResponse.json({ error: "Collection slug is required before uploading images." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = await verifyRasterImageUpload({ bytes, declaredType: file.type, label: "collection media" });
    const objectPath = `collections/${collectionSlug}/image-${Date.now()}-${crypto.randomUUID()}${image.extension}`;
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage.from("product-media").upload(objectPath, image.bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: image.contentType,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = admin.storage.from("product-media").getPublicUrl(objectPath);

    return NextResponse.json({
      url: data.publicUrl,
      path: objectPath,
    });
  } catch (error) {
    if (isMediaUploadValidationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to upload the image right now.") }, { status: 500 });
  }
}
