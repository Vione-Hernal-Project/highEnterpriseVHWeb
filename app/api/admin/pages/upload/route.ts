import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { normalizeSitePageSlug } from "@/lib/site-pages";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_PAGE_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PAGE_MEDIA_REQUEST_BYTES = 12 * 1024 * 1024;
const PAGE_MEDIA_UPLOAD_WINDOW_MS = 10 * 60_000;
const PAGE_MEDIA_UPLOAD_LIMIT = 40;

function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");

  return lastDot >= 0 ? fileName.slice(lastDot).replace(/[^a-zA-Z0-9.]/g, "") : "";
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

    const bodySizeError = getJsonBodySizeError(request, MAX_PAGE_MEDIA_REQUEST_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:pages:upload:user:${user.id}`,
      limit: PAGE_MEDIA_UPLOAD_LIMIT,
      windowMs: PAGE_MEDIA_UPLOAD_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many page media uploads were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const pageSlug = sanitizePathSegment(normalizeSitePageSlug(String(formData.get("slug") || "")));

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }

    if (file.size > MAX_PAGE_MEDIA_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
    }

    if (!pageSlug) {
      return NextResponse.json({ error: "Page slug is required before uploading images." }, { status: 400 });
    }

    if (file.type && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, and WEBP image uploads are supported." }, { status: 400 });
    }

    const fileName = typeof (file as { name?: unknown }).name === "string" ? (file as { name: string }).name : "upload";
    const extension = getFileExtension(fileName);

    if (extension.toLowerCase() === ".svg") {
      return NextResponse.json({ error: "SVG uploads are not supported for page media." }, { status: 400 });
    }

    const objectPath = `pages/${pageSlug}/featured-${Date.now()}-${crypto.randomUUID()}${extension}`;
    const admin = createSupabaseAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from("product-media").upload(objectPath, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
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
    return NextResponse.json({ error: getErrorMessage(error, "Unable to upload the image right now.") }, { status: 500 });
  }
}
