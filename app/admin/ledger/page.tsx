import Link from "next/link";

import { AllocationLedger } from "@/components/admin/allocation-ledger";
import { requireManagementUser } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export default async function AdminLedgerPage() {
  const { role } = await requireManagementUser();
  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load the allocation ledger right now.");
  }

  return (
    <section className="vh-page-shell">
      {loadError || !snapshot ? (
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Allocation Ledger</p>
          <h1 className="vh-mvp-title">Live fund routing is temporarily unavailable.</h1>
          <p className="vh-mvp-copy">
            This admin-only page depends on the new ledger tables and realtime subscriptions. Once the data layer is
            available, it will show your payment-distribution breakdown and VHL allocation framework automatically.
          </p>
          <div className="vh-status vh-status--error">{loadError || "The allocation ledger could not be initialized."}</div>
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/admin">
              Back To Admin
            </Link>
          </div>
        </div>
      ) : (
        <AllocationLedger initialSnapshot={snapshot} role={role} />
      )}
    </section>
  );
}
