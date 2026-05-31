import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { loadPublicBrandingSettings } from "@/lib/admin/settings";
import { contentTypeForPublicAssetUrl, isAllowedBrandingAssetUrl } from "@/lib/security/asset-urls";
import { resolveSafePublicAssetPath } from "@/lib/security/asset-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_FAVICON_PATH = join(process.cwd(), "public", "assets", "branding-defaults", "favicon.ico");

async function fallbackFaviconResponse() {
  const bytes = await readFile(FALLBACK_FAVICON_PATH);

  return new NextResponse(bytes, {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "Content-Type": "image/x-icon",
    },
  });
}

export async function GET() {
  try {
    const branding = await loadPublicBrandingSettings();
    const faviconUrl = branding.faviconUrl || branding.logoUrl;

    if (!faviconUrl || faviconUrl === "/favicon.ico" || !isAllowedBrandingAssetUrl(faviconUrl)) {
      return fallbackFaviconResponse();
    }

    if (faviconUrl.startsWith("/")) {
      const safePath = resolveSafePublicAssetPath(faviconUrl);

      if (!safePath) {
        return fallbackFaviconResponse();
      }

      const bytes = await readFile(safePath);

      return new NextResponse(bytes, {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "Content-Type": contentTypeForPublicAssetUrl(faviconUrl),
        },
      });
    }

    const response = await fetch(faviconUrl, { cache: "no-store" });

    if (!response.ok) {
      return fallbackFaviconResponse();
    }

    const bytes = await response.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Content-Type": contentTypeForPublicAssetUrl(faviconUrl),
      },
    });
  } catch {
    return fallbackFaviconResponse();
  }
}
