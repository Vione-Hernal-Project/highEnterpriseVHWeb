import { NextResponse } from "next/server";

import { loadFreshPublicStorefrontSettings } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await loadFreshPublicStorefrontSettings();

  return NextResponse.json(
    { settings },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
