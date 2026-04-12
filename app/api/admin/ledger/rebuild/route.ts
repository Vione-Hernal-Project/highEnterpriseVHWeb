import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import {
  rebuildPaymentAllocationBackfill,
  type PaymentAllocationBackfillMode,
} from "@/lib/admin/payment-allocation-sync";
import { getErrorMessage } from "@/lib/http";

function resolveBackfillMode(value: unknown): PaymentAllocationBackfillMode {
  return value === "all" ? "all" : "missing";
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

    const body = await request.json().catch(() => null);
    const mode = resolveBackfillMode(body?.mode);
    const result = await rebuildPaymentAllocationBackfill(mode);
    const snapshot = await loadAllocationLedgerSnapshot();
    const message =
      result.rebuiltPaymentsCount > 0
        ? `Ledger rebuild complete. Rebuilt ${result.rebuiltPaymentsCount} paid payment allocation set${
            result.rebuiltPaymentsCount === 1 ? "" : "s"
          }.`
        : "Ledger rebuild complete. No missing allocation rows were found.";

    return NextResponse.json({
      message,
      result,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to rebuild the allocation ledger right now.") }, { status: 500 });
  }
}
