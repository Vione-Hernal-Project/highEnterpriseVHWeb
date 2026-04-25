import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import {
  rebuildPaymentAllocationBackfill,
  type PaymentAllocationBackfillMode,
} from "@/lib/admin/payment-allocation-sync";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";

const ADMIN_LEDGER_REBUILD_WINDOW_MS = 10 * 60_000;
const ADMIN_LEDGER_REBUILD_LIMIT = 12;
const ADMIN_LEDGER_REBUILD_BODY_LIMIT_BYTES = 8 * 1024;

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

    const bodySizeError = getJsonBodySizeError(request, ADMIN_LEDGER_REBUILD_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:ledger:rebuild:user:${user.id}`,
      limit: ADMIN_LEDGER_REBUILD_LIMIT,
      windowMs: ADMIN_LEDGER_REBUILD_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many ledger rebuild attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
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
