import Link from "next/link";
import { Layers3 } from "lucide-react";

import { requireAdminArea } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

export default async function AdminLedgerDistributionPage() {
  await requireAdminArea("ledger");

  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load payment distribution right now.");
  }

  return (
    <section className="vh-page-shell">
      {loadError || !snapshot ? (
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Payment Distribution</p>
          <h1 className="vh-mvp-title">Allocation categories are temporarily unavailable.</h1>
          <div className="vh-status vh-status--error">{loadError || "The distribution view could not be initialized."}</div>
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/admin/orders">
              Back To Orders
            </Link>
          </div>
        </div>
      ) : (
        <div className="vh-ledger-shell vh-ledger-command-shell vh-ledger-distribution-page">
          <section className="vh-ledger-command-hero">
            <div className="vh-ledger-command-hero__copy">
              <p className="vh-mvp-eyebrow">Payment Distribution</p>
              <h1 className="vh-mvp-title">Allocation categories.</h1>
              <p className="vh-mvp-copy">
                A focused owner view of how confirmed payment value is routed across Vione Hernal’s operating buckets.
              </p>
            </div>
            <div className="vh-ledger-command-hero__controls">
              <Link className="vh-button vh-button--ghost" href="/admin/orders">
                Back To Orders
              </Link>
            </div>
          </section>

          <section className="vh-ledger-distribution-stats" aria-label="Allocation summary">
            <article>
              <span>Active Model</span>
              <strong>{snapshot.summary.activePercentageLabel}</strong>
              <p>Configured allocation total</p>
            </article>
            <article>
              <span>Categories</span>
              <strong>{snapshot.categories.length}</strong>
              <p>Operating buckets</p>
            </article>
            <article>
              <span>Confirmed Value</span>
              <strong>{snapshot.summary.totalReceivedLabel}</strong>
              <p>Paid records routed</p>
            </article>
            <article>
              <span>Currency</span>
              <strong>{snapshot.summary.primaryCurrency}</strong>
              <p>Primary ledger view</p>
            </article>
          </section>

          <section className="vh-ledger-panel vh-ledger-panel--section">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Allocation Breakdown</p>
                <h2 className="h3 u-margin-b--sm">{snapshot.summary.activePercentageLabel} active distribution model.</h2>
              </div>
              <Layers3 size={18} />
            </div>

            <div className="vh-ledger-allocation-strip" aria-label="Allocation breakdown">
              <div className="vh-ledger-allocation-strip__bar">
                {snapshot.categories.map((category) => (
                  <span
                    key={category.id}
                    style={{
                      width: `${Math.max(0, category.percentageBasisPoints / 100)}%`,
                      backgroundColor: category.color,
                    }}
                  />
                ))}
              </div>
              <div className="vh-ledger-allocation-strip__legend">
                {snapshot.categories.map((category) => (
                  <span key={category.id}>
                    <i style={{ backgroundColor: category.color }} aria-hidden="true" />
                    {category.name} {category.percentageLabel}
                  </span>
                ))}
              </div>
            </div>

            <div className="vh-ledger-breakdown-list">
              {snapshot.categories.length ? (
                snapshot.categories.map((category, index) => (
                  <article key={category.id} className="vh-ledger-breakdown-row vh-ledger-category-card">
                    <div className="vh-ledger-breakdown-row__header">
                      <div className="vh-ledger-breakdown-row__title">
                        <span className="vh-ledger-category-card__index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="vh-ledger-swatch" style={{ backgroundColor: category.color }} aria-hidden="true" />
                        <div>
                          <strong>{category.name}</strong>
                          <p className="u-margin-b--none">{category.lead || category.description || "Allocation category"}</p>
                        </div>
                      </div>
                      <div className="vh-ledger-breakdown-row__totals">
                        <span>{category.withdrawableAmountLabel}</span>
                        <span>{category.percentageLabel}</span>
                      </div>
                    </div>
                    <div className="vh-ledger-breakdown-row__bar">
                      <span
                        className="vh-ledger-breakdown-row__fill"
                        style={{
                          width: `${category.withdrawableAmount > 0 ? Math.max(8, category.shareOfTotal) : 0}%`,
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                    <div className="vh-ledger-category-card__metrics">
                      <span>
                        <b>{category.totalAllocatedLabel}</b>
                        Total allocated
                      </span>
                      <span>
                        <b>{category.totalCashedOutLabel}</b>
                        Cashed out
                      </span>
                      <span>
                        <b>{category.withdrawableAmountLabel}</b>
                        Withdrawable
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="vh-empty">No allocation categories are active yet.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
