import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "ledger")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const snapshot = await loadAllocationLedgerSnapshot({
      date: searchParams.get("date"),
    });

    return NextResponse.json(
      { snapshot },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load the allocation ledger right now.") }, { status: 500 });
  }
}
