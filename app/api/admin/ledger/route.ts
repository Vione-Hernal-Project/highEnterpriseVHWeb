import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const snapshot = await loadAllocationLedgerSnapshot();

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
