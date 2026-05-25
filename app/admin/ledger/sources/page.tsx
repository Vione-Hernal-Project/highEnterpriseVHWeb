import Link from "next/link";
import { Wallet } from "lucide-react";

import { requireManagementUser } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export default async function AdminLedgerSourcesPage() {
  await requireManagementUser();

  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load payment sources right now.");
  }

  return (
    <section className="vh-page-shell">
      {loadError || !snapshot ? (
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Payment Source</p>
          <h1 className="vh-mvp-title">Payment source groups are temporarily unavailable.</h1>
          <div className="vh-status vh-status--error">{loadError || "The payment source view could not be initialized."}</div>
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
              <p className="vh-mvp-eyebrow">Payment Source</p>
              <h1 className="vh-mvp-title">Wallet and settlement sources.</h1>
              <p className="vh-mvp-copy">
                See where confirmed on-chain funds entered the ledger without changing the underlying payment records.
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
                <p className="vh-mvp-eyebrow">Sources</p>
                <h2 className="h3 u-margin-b--sm">{snapshot.sources.length} tracked payment source group{snapshot.sources.length === 1 ? "" : "s"}.</h2>
              </div>
              <Wallet size={18} />
            </div>

            <div className="vh-ledger-source-list">
              {snapshot.sources.length ? (
                snapshot.sources.map((source) => (
                  <article key={source.key} className="vh-ledger-source-item">
                    <div>
                      <strong>{source.label}</strong>
                      <p className="u-margin-b--none">
                        {source.channel} · {source.methodLabel}
                      </p>
                      <small>{source.latestReference}</small>
                    </div>
                    <div className="vh-ledger-source-item__totals">
                      <span>{source.totalAmountLabel}</span>
                      <span>{source.count} payments</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="vh-empty">No successful payment sources have been recorded yet.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
