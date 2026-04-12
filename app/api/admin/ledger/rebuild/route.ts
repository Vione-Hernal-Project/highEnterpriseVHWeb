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
    const remainingMissingCount = snapshot.cashOut.missingAllocationPaymentCount;
    const message =
      result.rebuiltPaymentsCount > 0
        ? remainingMissingCount === 0
          ? `Ledger rebuild complete. Rebuilt ${result.rebuiltPaymentsCount} confirmed on-chain payment allocation set${
              result.rebuiltPaymentsCount === 1 ? "" : "s"
            }. Cash-out balances now include the rebuilt allocations.`
          : `Ledger rebuild complete. Rebuilt ${result.rebuiltPaymentsCount} confirmed on-chain payment allocation set${
              result.rebuiltPaymentsCount === 1 ? "" : "s"
            }, but ${remainingMissingCount} confirmed on-chain payment${
              remainingMissingCount === 1 ? "" : "s"
            } still need allocation rows.`
        : remainingMissingCount === 0
          ? "Ledger rebuild complete. No missing confirmed on-chain allocation rows were found."
          : `Ledger rebuild finished, but ${remainingMissingCount} confirmed on-chain payment${
              remainingMissingCount === 1 ? "" : "s"
            } still need allocation rows.`;

    return NextResponse.json({
      message,
      result,
      snapshot,
      validation: {
        missingAllocationPaymentCount: remainingMissingCount,
        cashOutBalancesIncludeRebuiltAllocations: remainingMissingCount === 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to rebuild the allocation ledger right now.") }, { status: 500 });
  }
}
