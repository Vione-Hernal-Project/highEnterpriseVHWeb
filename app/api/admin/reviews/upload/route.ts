import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { sanitizeStoragePathSegment, verifyUploadFile } from "@/lib/security/uploads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_REVIEW_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REVIEW_MEDIA_REQUEST_BYTES = 12 * 1024 * 1024;
const REVIEW_MEDIA_UPLOAD_WINDOW_MS = 10 * 60_000;
const REVIEW_MEDIA_UPLOAD_LIMIT = 40;

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, MAX_REVIEW_MEDIA_REQUEST_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:reviews:upload:user:${user.id}`,
      limit: REVIEW_MEDIA_UPLOAD_LIMIT,
      windowMs: REVIEW_MEDIA_UPLOAD_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many review media uploads were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const productId = sanitizeStoragePathSegment(String(formData.get("productId") || ""));

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an image or video file to upload." }, { status: 400 });
    }

    if (file.size > MAX_REVIEW_MEDIA_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Review media must be 10 MB or smaller." }, { status: 413 });
    }

    if (!productId) {
      return NextResponse.json({ error: "Choose a product before uploading review media." }, { status: 400 });
    }

    const verifiedUpload = await verifyUploadFile(file, ["jpeg", "mp4", "png", "webp"]);

    if (!verifiedUpload) {
      return NextResponse.json({ error: "Only PNG, JPG, WEBP, or MP4 uploads are supported." }, { status: 400 });
    }

    const objectPath = `reviews/${productId}/media-${Date.now()}-${crypto.randomUUID()}${verifiedUpload.extension}`;
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage.from("product-media").upload(objectPath, verifiedUpload.bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: verifiedUpload.contentType,
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
    return NextResponse.json({ error: getErrorMessage(error, "Unable to upload the review media right now.") }, { status: 500 });
  }
}
