import Link from "next/link";
import { Activity } from "lucide-react";

import { requireAdminArea } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";
import { formatDateTime } from "@/lib/utils";

export default async function AdminLedgerCurrenciesPage() {
  await requireAdminArea("ledger");

  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load currency watch right now.");
  }

  return (
    <section className="vh-page-shell">
      {loadError || !snapshot ? (
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Currency Watch</p>
          <h1 className="vh-mvp-title">Tracked ledger currencies are temporarily unavailable.</h1>
          <div className="vh-status vh-status--error">{loadError || "The currency watch view could not be initialized."}</div>
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
              <p className="vh-mvp-eyebrow">Currency Watch</p>
              <h1 className="vh-mvp-title">Ledger currency exposure.</h1>
              <p className="vh-mvp-copy">
                A focused view of the currencies currently represented by confirmed payment and allocation records.
              </p>
            </div>
            <div className="vh-ledger-command-hero__controls">
              <Link className="vh-button vh-button--ghost" href="/admin/orders">
                Back To Orders
              </Link>
            </div>
          </section>

          <section className="vh-ledger-panel vh-ledger-panel--section">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Tracked Currencies</p>
                <h2 className="h3 u-margin-b--sm">
                  {snapshot.summary.currencyTotals.length} ledger currenc{snapshot.summary.currencyTotals.length === 1 ? "y" : "ies"}.
                </h2>
              </div>
              <Activity size={18} />
            </div>

            <div className="vh-ledger-ticker vh-ledger-ticker--stacked">
              {snapshot.summary.currencyTotals.length ? (
                snapshot.summary.currencyTotals.map((currencyTotal) => (
                  <div key={currencyTotal.currency} className="vh-ledger-ticker__item">
                    <span>{currencyTotal.currency}</span>
                    <strong>{currencyTotal.label}</strong>
                  </div>
                ))
              ) : (
                <div className="vh-empty">No currencies have been recorded yet.</div>
              )}
            </div>
            <p className="vh-ledger-command-sync">Synced {formatDateTime(snapshot.generatedAt)}</p>
          </section>
        </div>
      )}
    </section>
  );
}
