import Link from "next/link";

import { LedgerCashOutRoute } from "@/components/admin/ledger-cash-out-route";
import { requireAdminArea } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export default async function AdminLedgerCashOutPage() {
  await requireAdminArea("dashboard");

  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load cash-out control right now.");
  }

  return (
    <section className="vh-page-shell">
      {loadError || !snapshot ? (
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Cash-Out Control</p>
          <h1 className="vh-mvp-title">Treasury controls are temporarily unavailable.</h1>
          <div className="vh-status vh-status--error">{loadError || "The cash-out view could not be initialized."}</div>
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/admin/orders">
              Back To Orders
            </Link>
          </div>
        </div>
      ) : (
        <div className="vh-ledger-shell vh-ledger-command-shell">
          <section className="vh-ledger-command-hero">
            <div className="vh-ledger-command-hero__copy">
              <p className="vh-mvp-eyebrow">Cash-Out Control</p>
              <h1 className="vh-mvp-title">Treasury movement.</h1>
              <p className="vh-mvp-copy">
                Process recorded owner cash-outs against the same allocation balances already used by the main ledger.
              </p>
            </div>
            <div className="vh-ledger-command-hero__controls">
              <Link className="vh-button vh-button--ghost" href="/admin/orders">
                Back To Orders
              </Link>
            </div>
          </section>

          <LedgerCashOutRoute initialSnapshot={snapshot} />
        </div>
      )}
    </section>
  );
}
