import { NextResponse } from "next/server";

import { loadPublicBrandingSettings, versionAssetUrl } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await loadPublicBrandingSettings();

  return NextResponse.json({
    ...branding,
    logoUrl: versionAssetUrl(branding.logoUrl, branding.brandingVersion),
    faviconUrl: versionAssetUrl("/favicon.ico", branding.brandingVersion),
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
