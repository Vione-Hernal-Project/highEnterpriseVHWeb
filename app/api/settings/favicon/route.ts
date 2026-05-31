import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { loadPublicBrandingSettings } from "@/lib/admin/settings";
import { resolveSafePublicAssetPath } from "@/lib/security/asset-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_FAVICON_PATH = join(process.cwd(), "public", "assets", "branding-defaults", "favicon.ico");
const ALLOWED_FAVICON_CONTENT_TYPES = new Set([
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/png",
  "image/webp",
  "image/jpeg",
]);

function contentTypeForUrl(url: string) {
  const pathname = url.split("?")[0]?.toLowerCase() || "";

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";

  return "image/x-icon";
}

function isAllowedFaviconUrl(url: string) {
  const pathname = url.split("?")[0]?.toLowerCase() || "";

  return /\.(?:ico|png|webp|jpe?g)$/.test(pathname);
}

function isAllowedRemoteFaviconUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "https:" && isAllowedFaviconUrl(url);
  } catch {
    return false;
  }
}

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

    if (!faviconUrl || faviconUrl === "/favicon.ico") {
      return fallbackFaviconResponse();
    }

    if (faviconUrl.startsWith("/")) {
      if (!isAllowedFaviconUrl(faviconUrl)) {
        return fallbackFaviconResponse();
      }

      const localFaviconPath = resolveSafePublicAssetPath(faviconUrl);

      if (!localFaviconPath) {
        return fallbackFaviconResponse();
      }

      const bytes = await readFile(localFaviconPath);

      return new NextResponse(bytes, {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "Content-Type": contentTypeForUrl(faviconUrl),
        },
      });
    }

    if (!isAllowedRemoteFaviconUrl(faviconUrl)) {
      return fallbackFaviconResponse();
    }

    const response = await fetch(faviconUrl, { cache: "no-store" });

    if (!response.ok) {
      return fallbackFaviconResponse();
    }

    const responseContentType = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();

    if (responseContentType && !ALLOWED_FAVICON_CONTENT_TYPES.has(responseContentType)) {
      return fallbackFaviconResponse();
    }

    const bytes = await response.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Content-Type": response.headers.get("Content-Type") || contentTypeForUrl(faviconUrl),
      },
    });
  } catch {
    return fallbackFaviconResponse();
  }
}
