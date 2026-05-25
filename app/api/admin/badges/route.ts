import { NextResponse } from "next/server";

import { loadAdminBadgeCounts } from "@/lib/admin/badges";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    return NextResponse.json(await loadAdminBadgeCounts(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load admin badge counts right now.") }, { status: 500 });
  }
}
