import { NextResponse } from "next/server";
import sharp from "sharp";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { verifyUploadFile } from "@/lib/security/uploads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_BRANDING_MEDIA_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_BRANDING_MEDIA_REQUEST_BYTES = 6 * 1024 * 1024;
const BRANDING_MEDIA_UPLOAD_WINDOW_MS = 10 * 60_000;
const BRANDING_MEDIA_UPLOAD_LIMIT = 30;

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function sampleCornerBackground(data: Buffer, width: number, height: number) {
  const sampleSize = Math.max(2, Math.min(28, Math.floor(Math.min(width, height) / 6)));
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3] ?? 255;

        if (alpha < 8) {
          continue;
        }

        red += data[index] || 0;
        green += data[index + 1] || 0;
        blue += data[index + 2] || 0;
        count += 1;
      }
    }
  }

  return count ? { red: red / count, green: green / count, blue: blue / count } : { red: 255, green: 255, blue: 255 };
}

function removeLightLogoBackground(data: Buffer, width: number, height: number) {
  const background = sampleCornerBackground(data, width, height);
  const backgroundLuma = (background.red + background.green + background.blue) / 3;
  const transparentDistance = backgroundLuma > 210 ? 38 : 28;
  const featherDistance = backgroundLuma > 210 ? 92 : 68;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] || 0;
    const green = data[index + 1] || 0;
    const blue = data[index + 2] || 0;
    const alpha = data[index + 3] || 0;

    if (alpha < 8) {
      data[index + 3] = 0;
      continue;
    }

    const luma = (red + green + blue) / 3;
    const distance = colorDistance(red, green, blue, background.red, background.green, background.blue);
    const isNearLightBackground = luma > 158 && distance < featherDistance;
    const isAlmostWhite = red > 244 && green > 244 && blue > 244;

    if (isAlmostWhite || (isNearLightBackground && distance <= transparentDistance)) {
      data[index + 3] = 0;
      continue;
    }

    if (isNearLightBackground) {
      const featherAlpha = Math.max(0, Math.min(1, (distance - transparentDistance) / (featherDistance - transparentDistance)));
      data[index + 3] = Math.round(alpha * featherAlpha);
    }

    if ((data[index + 3] || 0) > 0 && luma < 210) {
      data[index] = 32;
      data[index + 1] = 31;
      data[index + 2] = 28;
    }
  }
}

async function createTransparentBrandMark(bytes: Uint8Array, size: number) {
  const innerSize = Math.round(size * 0.72);
  const paddingStart = Math.floor((size - innerSize) / 2);
  const paddingEnd = size - innerSize - paddingStart;

  const { data, info } = await sharp(bytes, { animated: false })
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeLightLogoBackground(data, info.width, info.height);

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ threshold: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .extend({
      top: paddingStart,
      right: paddingEnd,
      bottom: paddingEnd,
      left: paddingStart,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function createOptimizedLogo(bytes: Uint8Array) {
  return createTransparentBrandMark(bytes, 512);
}

async function createOptimizedFavicon(bytes: Uint8Array) {
  return createTransparentBrandMark(bytes, 96);
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

    const bodySizeError = getJsonBodySizeError(request, MAX_BRANDING_MEDIA_REQUEST_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:settings:branding-upload:user:${user.id}`,
      limit: BRANDING_MEDIA_UPLOAD_LIMIT,
      windowMs: BRANDING_MEDIA_UPLOAD_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many branding uploads were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "logo") === "favicon" ? "favicon" : "logo";

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }

    if (file.size > MAX_BRANDING_MEDIA_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Branding images must be 4 MB or smaller." }, { status: 413 });
    }

    const verifiedUpload = await verifyUploadFile(file, kind === "favicon" ? ["ico", "jpeg", "png", "webp"] : ["jpeg", "png", "webp"]);

    if (!verifiedUpload) {
      return NextResponse.json(
        { error: kind === "favicon" ? "Only PNG, JPG, WEBP, and ICO favicon uploads are supported." : "Only PNG, JPG, and WEBP logo uploads are supported." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const uploadPath =
      kind === "favicon" && verifiedUpload.kind === "ico"
        ? `branding/favicon-${Date.now()}-${crypto.randomUUID()}.ico`
        : `branding/${kind}-${Date.now()}-${crypto.randomUUID()}.png`;
    const uploadBytes =
      kind === "logo"
        ? await createOptimizedLogo(verifiedUpload.bytes)
        : verifiedUpload.kind === "ico"
          ? verifiedUpload.bytes
          : await createOptimizedFavicon(verifiedUpload.bytes);
    const uploadContentType = uploadPath.endsWith(".ico") ? "image/x-icon" : "image/png";
    const { error: uploadError } = await admin.storage.from("product-media").upload(uploadPath, uploadBytes, {
      cacheControl: "31536000",
      upsert: false,
      contentType: uploadContentType,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = admin.storage.from("product-media").getPublicUrl(uploadPath);
    let faviconUrl = data.publicUrl;

    if (kind === "logo") {
      const faviconBytes = await createOptimizedFavicon(verifiedUpload.bytes);
      const faviconPath = `branding/favicon-${Date.now()}-${crypto.randomUUID()}.png`;
      const { error: faviconUploadError } = await admin.storage.from("product-media").upload(faviconPath, faviconBytes, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/png",
      });

      if (!faviconUploadError) {
        const { data: faviconData } = admin.storage.from("product-media").getPublicUrl(faviconPath);
        faviconUrl = faviconData.publicUrl;
      }
    }

    const version = Date.now().toString();

    return NextResponse.json({
      url: data.publicUrl,
      faviconUrl,
      path: uploadPath,
      version,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to upload the branding image right now.") }, { status: 500 });
  }
}
