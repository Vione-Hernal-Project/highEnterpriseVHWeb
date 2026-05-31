import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { loadPublicBrandingSettings } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_FAVICON_PATH = join(process.cwd(), "public", "assets", "branding-defaults", "favicon.ico");

function contentTypeForUrl(url: string) {
  const pathname = url.split("?")[0]?.toLowerCase() || "";

  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";

  return "image/x-icon";
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
      const bytes = await readFile(join(process.cwd(), "public", faviconUrl));

      return new NextResponse(bytes, {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "Content-Type": contentTypeForUrl(faviconUrl),
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
        "Content-Type": response.headers.get("Content-Type") || contentTypeForUrl(faviconUrl),
      },
    });
  } catch {
    return fallbackFaviconResponse();
  }
}
