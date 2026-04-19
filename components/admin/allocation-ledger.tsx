"use client";

import Link from "next/link";
import { Activity, History, Layers3, MoveRight, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { LedgerCashOutPanel } from "@/components/admin/ledger-cash-out-panel";
import { getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { formatLedgerCurrency, type AllocationLedgerSnapshot } from "@/lib/fund-allocation";

type Props = {
  initialSnapshot: AllocationLedgerSnapshot;
  role: string;
};

type LedgerPayment = AllocationLedgerSnapshot["latestPayments"][number];

function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const currentValueRef = useRef(target);

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  useEffect(() => {
    const startValue = currentValueRef.current;
    const delta = target - startValue;
    const startTime = window.performance.now();
    let frameId = 0;

    if (Math.abs(delta) < 0.000001) {
      setValue(target);
      currentValueRef.current = target;
      return;
    }

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const nextValue = startValue + delta * easedProgress;

      setValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        currentValueRef.current = target;
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [duration, target]);

  return value;
}

function AnimatedAmount({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  const animatedAmount = useAnimatedNumber(amount);

  return <span className={className}>{formatLedgerCurrency(animatedAmount, currency)}</span>;
}

function getBuyerDisplayName(payment: LedgerPayment) {
  if (payment.customerName?.trim()) {
    return payment.customerName.trim();
  }

  if (payment.email?.trim()) {
    return payment.email.trim().split("@")[0] || payment.email.trim();
  }

  if (payment.sourceDetail?.trim()) {
    return payment.sourceDetail.trim();
  }

  return payment.orderNumber ? `Order ${payment.orderNumber}` : "Anonymous buyer";
}

function formatFeedTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AllocationLedger({ initialSnapshot, role }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(initialSnapshot.generatedAt);
  const [selectedPaymentId, setSelectedPaymentId] = useState(initialSnapshot.latestPayments[0]?.id ?? "");

  const applySnapshotUpdate = useEffectEvent((nextSnapshot: AllocationLedgerSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setLastSyncedAt(nextSnapshot.generatedAt);
      setError("");
    });
  });

  const refreshSnapshot = useEffectEvent(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(`/api/admin/ledger?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await readJsonSafely<{ error?: string; snapshot?: AllocationLedgerSnapshot }>(response);

      if (!response.ok || !payload?.snapshot) {
        throw new Error(getResponseErrorMessage(payload, "Unable to refresh the allocation ledger."));
      }

      const nextSnapshot = payload.snapshot;

      applySnapshotUpdate(nextSnapshot);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh the allocation ledger.");
    } finally {
      setRefreshing(false);
    }
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: number | null = null;
    const fallbackInterval = window.setInterval(() => {
      void refreshSnapshot();
    }, 30000);

    const queueRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshSnapshot();
      }, 250);
    };

    const channel = supabase
      .channel("admin-allocation-ledger")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_allocations" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_allocation_rules" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_cash_outs" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_cash_out_breakdowns" }, queueRefresh)
      .subscribe();

    return () => {
      window.clearInterval(fallbackInterval);

      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!snapshot.latestPayments.length) {
      setSelectedPaymentId("");
      return;
    }

    if (!snapshot.latestPayments.some((payment) => payment.id === selectedPaymentId)) {
      setSelectedPaymentId(snapshot.latestPayments[0]!.id);
    }
  }, [selectedPaymentId, snapshot.latestPayments]);

  const latestPayment = snapshot.latestPayments[0] || null;
  const selectedPayment = snapshot.latestPayments.find((payment) => payment.id === selectedPaymentId) || latestPayment;
  const liveBuyFeed = snapshot.latestPayments.slice(0, 5);
  const tickerItems = liveBuyFeed.length ? [...liveBuyFeed, ...liveBuyFeed] : [];

  return (
    <div className="vh-ledger-shell">
      <section className="vh-ledger-hero">
        <div className="vh-ledger-hero__header">
          <div>
            <p className="vh-mvp-eyebrow">Admin Ledger</p>
            <h1 className="vh-mvp-title">Vione Hernal payment distribution, live and structured.</h1>
            <p className="vh-mvp-copy">
              This admin-only page maps each successful payment into your current sales-allocation model, then pairs it
              with the broader VHL token-allocation framework for internal visibility.
            </p>
          </div>

          <div className="vh-ledger-hero__actions">
            <span className="vh-ledger-live-pill">
              <span className="vh-ledger-live-pill__dot" aria-hidden="true" />
              {refreshing ? "Refreshing" : "Live"}
            </span>
            <Link className="vh-button vh-button--ghost" href="/admin">
              Back To Admin
            </Link>
          </div>
        </div>

        <div className="vh-ledger-summary-grid" aria-live="polite">
          <article className="vh-ledger-stat-card">
            <div className="vh-ledger-stat-card__icon">
              <Wallet size={18} />
            </div>
            <p className="vh-ledger-stat-card__label">Total Funds Received</p>
            <AnimatedAmount
              amount={snapshot.summary.totalReceived}
              currency={snapshot.summary.primaryCurrency}
              className="vh-ledger-stat-card__value"
            />
            <p className="vh-ledger-stat-card__meta">
              {snapshot.summary.currencyTotals.length > 1
                ? `${snapshot.summary.currencyTotals.length} tracked currencies`
                : "Normalized to the primary ledger currency"}
            </p>
          </article>

          <article className="vh-ledger-stat-card">
            <div className="vh-ledger-stat-card__icon">
              <Activity size={18} />
            </div>
            <p className="vh-ledger-stat-card__label">Successful Payments</p>
            <span className="vh-ledger-stat-card__value">{snapshot.summary.totalPayments}</span>
            <p className="vh-ledger-stat-card__meta">
              Latest activity {snapshot.summary.latestPaymentAt ? formatDateTime(snapshot.summary.latestPaymentAt) : "pending"}
            </p>
          </article>

          <article className="vh-ledger-stat-card">
            <div className="vh-ledger-stat-card__icon">
              <Layers3 size={18} />
            </div>
            <p className="vh-ledger-stat-card__label">Allocation Coverage</p>
            <span className="vh-ledger-stat-card__value">{snapshot.summary.activePercentageLabel}</span>
            <p className="vh-ledger-stat-card__meta">{snapshot.summary.activeCategories} active categories</p>
          </article>

          <article className="vh-ledger-stat-card">
            <div className="vh-ledger-stat-card__icon">
              <ShieldCheck size={18} />
            </div>
            <p className="vh-ledger-stat-card__label">Withdrawable Balance</p>
            <span className="vh-ledger-stat-card__value">
              {formatLedgerCurrency(snapshot.cashOut.withdrawableAmount, snapshot.cashOut.primaryCurrency)}
            </span>
            <p className="vh-ledger-stat-card__meta">
              {role} access · {snapshot.summary.activeSources} live source buckets
            </p>
          </article>
        </div>

        <div className="vh-ledger-flow-ribbon" aria-label="Ledger flow">
          <div className="vh-ledger-flow-step">
            <span className="vh-ledger-flow-step__label">1</span>
            <strong>Payment confirmed</strong>
          </div>
          <MoveRight size={18} />
          <div className="vh-ledger-flow-step">
            <span className="vh-ledger-flow-step__label">2</span>
            <strong>Ledger allocation engine</strong>
          </div>
          <MoveRight size={18} />
          <div className="vh-ledger-flow-step">
            <span className="vh-ledger-flow-step__label">3</span>
            <strong>Category routing + history</strong>
          </div>
        </div>

        <div className="vh-ledger-hero__editorial-grid">
          <div className="vh-ledger-mode-board">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Current Payment Mode</p>
                <h2 className="h3 u-margin-b--sm">Legacy gateway labels replaced with the wallet-based flow you use now.</h2>
              </div>
              <Sparkles size={18} />
            </div>

            <div className="vh-ledger-mode-list">
              {snapshot.currentPaymentModes.map((mode) => (
                <article key={mode.code} className="vh-ledger-mode-item">
                  <div className="vh-ledger-mode-item__topline">
                    <strong>{mode.title}</strong>
                    <span>{mode.status}</span>
                  </div>
                  <p className="u-margin-b--none">{mode.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="vh-ledger-example-board">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Example Split</p>
                <h2 className="h3 u-margin-b--sm">If {snapshot.preview.baseAmountLabel} is received, this is the routing logic.</h2>
              </div>
              <RefreshCw size={18} className={refreshing ? "vh-ledger-spin" : ""} />
            </div>

            <div className="vh-ledger-preview-list">
              {snapshot.preview.items.map((item) => (
                <div key={item.code} className="vh-ledger-preview-item">
                  <div className="vh-ledger-preview-item__copy">
                    <span className="vh-ledger-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <div>
                      <strong>{item.name}</strong>
                      <p className="u-margin-b--none">{item.percentageLabel}</p>
                    </div>
                  </div>
                  <div className="vh-ledger-preview-item__totals">
                    <strong>{item.amountLabel}</strong>
                  </div>
                  {item.subAllocations.length ? (
                    <div className="vh-ledger-suballocation-list">
                      {item.subAllocations.map((subAllocation) => (
                        <div key={subAllocation.code} className="vh-ledger-suballocation-item">
                          <span>{subAllocation.name}</span>
                          <strong>{subAllocation.amountLabel}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {latestPayment ? (
          <div className="vh-ledger-highlight">
            <div className="vh-ledger-highlight__ticker">
              <div className="vh-ledger-highlight__ticker-track">
                {tickerItems.map((payment, index) => (
                  <div key={`${payment.id}-${index}`} className="vh-ledger-highlight__ticker-item">
                    <span className="vh-ledger-highlight__ticker-badge">Buy</span>
                    <strong>{getBuyerDisplayName(payment)}</strong>
                    <span>{payment.receivedLabel}</span>
                    <span>{payment.paymentMethodLabel}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="vh-ledger-highlight__grid">
              <div className="vh-ledger-highlight__panel">
                <p className="vh-ledger-highlight__label">Last Successful Payment</p>
                <div className="vh-ledger-highlight__value">{latestPayment.receivedLabel}</div>
                <div className="vh-ledger-highlight__secondary">{latestPayment.sourceTitle}</div>
                <p className="vh-ledger-highlight__copy">{latestPayment.sourceDetail}</p>
              </div>

              <div className="vh-ledger-highlight__panel vh-ledger-highlight__panel--feed">
                <div className="vh-ledger-highlight__feed-header">
                  <div>
                    <p className="vh-ledger-highlight__label">Live Buyer Tape</p>
                    <p className="vh-ledger-highlight__copy">
                      A compact market-style view of the latest confirmed buys flowing into the ledger.
                    </p>
                  </div>
                </div>

                <div className="vh-ledger-buy-feed">
                  {liveBuyFeed.map((payment) => (
                    <div key={payment.id} className="vh-ledger-buy-feed__row">
                      <div className="vh-ledger-buy-feed__buyer">
                        <span className="vh-ledger-buy-feed__badge">Buy</span>
                        <div>
                          <strong>{getBuyerDisplayName(payment)}</strong>
                          <p className="u-margin-b--none">{payment.sourceTitle}</p>
                        </div>
                      </div>
                      <div className="vh-ledger-buy-feed__quote">
                        <strong>{payment.receivedLabel}</strong>
                        <span>
                          {payment.paymentMethodLabel} · {formatFeedTime(payment.paidAt)}
                        </span>
                        <span>{payment.allocations.length} allocations</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vh-ledger-highlight__panel">
                <p className="vh-ledger-highlight__label">Synced</p>
                <div className="vh-ledger-highlight__secondary">{formatDateTime(lastSyncedAt)}</div>
                <p className="vh-ledger-highlight__copy">Realtime watchers are subscribed to payments and allocation rows.</p>
                <div className="vh-ledger-highlight__mini-metrics">
                  <div>
                    <span>Buyers Tracked</span>
                    <strong>{snapshot.latestPayments.length}</strong>
                  </div>
                  <div>
                    <span>Live Sources</span>
                    <strong>{snapshot.summary.activeSources}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {snapshot.alerts.length ? (
        <div className="vh-status vh-status--error">
          {snapshot.alerts.map((alert) => (
            <p key={alert} className="u-margin-b--none">
              {alert}
            </p>
          ))}
        </div>
      ) : null}

      {error ? <div className="vh-status vh-status--error">{error}</div> : null}

      <div className="vh-ledger-dashboard">
        <div className="vh-ledger-main-column">
          <section className="vh-ledger-panel">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Payment Distribution</p>
                <h2 className="h3 u-margin-b--sm">Every successful payment is routed through the breakdown from your diagram.</h2>
              </div>
              <Sparkles size={18} />
            </div>

            <div className="vh-ledger-breakdown-list">
              {snapshot.categories.length ? (
                snapshot.categories.map((category) => (
                  <article key={category.id} className="vh-ledger-breakdown-row">
                    <div className="vh-ledger-breakdown-row__header">
                      <div className="vh-ledger-breakdown-row__title">
                        <span className="vh-ledger-swatch" style={{ backgroundColor: category.color }} aria-hidden="true" />
                        <div>
                          <strong>{category.name}</strong>
                          <p className="u-margin-b--none">{category.lead || category.description || "Allocation category"}</p>
                        </div>
                      </div>
                      <div className="vh-ledger-breakdown-row__totals">
                        <AnimatedAmount amount={category.withdrawableAmount} currency={snapshot.summary.primaryCurrency} />
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
                    {category.subAllocations.length ? (
                      <div className="vh-ledger-suballocation-list">
                        {category.subAllocations.map((subAllocation) => (
                          <div key={subAllocation.code} className="vh-ledger-suballocation-item">
                            <span>
                              {subAllocation.name}
                              {subAllocation.note ? ` · ${subAllocation.note}` : ""}
                            </span>
                            <strong>{subAllocation.amountLabel}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="vh-ledger-breakdown-row__meta">{category.paymentCount} successful payments contributed to this bucket.</p>
                  </article>
                ))
              ) : (
                <div className="vh-empty">No allocation categories are active yet.</div>
              )}
            </div>
          </section>

          <section className="vh-ledger-panel">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">VHL Token Allocation</p>
                <h2 className="h3 u-margin-b--sm">{snapshot.tokenAllocation.totalSupplyLabel} total supply framework.</h2>
              </div>
              <Layers3 size={18} />
            </div>

            <div className="vh-ledger-token-grid">
              {snapshot.tokenAllocation.items.map((item) => (
                <article key={item.code} className="vh-ledger-token-card">
                  <div className="vh-ledger-token-card__topline">
                    <strong>{item.name}</strong>
                    <span>{item.percentageLabel}</span>
                  </div>
                  <div className="vh-ledger-token-card__value">{item.tokenAmountLabel}</div>
                  <p className="vh-ledger-token-card__meta">
                    {item.fundedBySales ? "Included in the broader operating framework." : "Not funded through sales directly."}
                  </p>
                  <div className="vh-ledger-token-card__notes">
                    {item.notes.map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="vh-ledger-side-grid">
          <LedgerCashOutPanel snapshot={snapshot} onSnapshotUpdate={applySnapshotUpdate} />

          <section className="vh-ledger-panel">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Payment Source</p>
                <h2 className="h3 u-margin-b--sm">Where the funds entered from, using the current settlement flow.</h2>
              </div>
              <Wallet size={18} />
            </div>

            <div className="vh-ledger-source-list">
              {snapshot.sources.length ? (
                snapshot.sources.map((source) => (
                  <article key={source.key} className="vh-ledger-source-item">
                    <div>
                      <strong>{source.label}</strong>
                      <p className="u-margin-b--none">{source.latestReference}</p>
                    </div>
                    <div className="vh-ledger-source-item__totals">
                      <AnimatedAmount amount={source.totalAmount} currency={snapshot.summary.primaryCurrency} />
                      <span>{source.count} payments</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="vh-empty">No successful payment sources have been recorded yet.</div>
              )}
            </div>
          </section>

          <section className="vh-ledger-panel">
            <div className="vh-ledger-panel__header">
              <div>
                <p className="vh-mvp-eyebrow">Currency Watch</p>
                <h2 className="h3 u-margin-b--sm">Live currency totals and normalized ledger state.</h2>
              </div>
              <Activity size={18} />
            </div>

            <div className="vh-ledger-ticker vh-ledger-ticker--stacked">
              {snapshot.summary.currencyTotals.map((currencyTotal) => (
                <div key={currencyTotal.currency} className="vh-ledger-ticker__item">
                  <span>{currencyTotal.currency}</span>
                  <strong>{currencyTotal.label}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="vh-ledger-panel">
        <div className="vh-ledger-panel__header">
          <div>
            <p className="vh-mvp-eyebrow">Payment History</p>
            <h2 className="h3 u-margin-b--sm">Previous payments stay visible, with the fund-allocation trail for each one.</h2>
          </div>
          <History size={18} />
        </div>

        <div className="vh-ledger-history-shell">
          <div className="vh-ledger-history-list" role="list" aria-label="Ledger payment history">
            {snapshot.latestPayments.length ? (
              snapshot.latestPayments.map((payment, index) => {
                const isActive = payment.id === selectedPayment?.id;

                return (
                  <button
                    key={payment.id}
                    type="button"
                    className={`vh-ledger-history-item ${isActive ? "vh-ledger-history-item--active" : ""}`}
                    onClick={() => setSelectedPaymentId(payment.id)}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="vh-ledger-history-item__topline">
                      <span>{index === 0 ? "Latest" : `Previous #${index}`}</span>
                      <strong>{payment.receivedLabel}</strong>
                    </div>
                    <div className="vh-ledger-history-item__title">
                      {payment.orderNumber ? `Order ${payment.orderNumber}` : "Direct payment"}
                    </div>
                    <div className="vh-ledger-history-item__meta">
                      <span>{payment.sourceTitle}</span>
                      <span>{formatDateTime(payment.paidAt)}</span>
                    </div>
                    <div className="vh-ledger-history-item__trail">
                      {payment.allocations.slice(0, 3).map((allocation) => (
                        <span key={allocation.id}>
                          <i style={{ backgroundColor: allocation.color }} aria-hidden="true" />
                          {allocation.name}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="vh-empty">No successful payments have reached the allocation ledger yet.</div>
            )}
          </div>

          <div className="vh-ledger-history-detail">
            {selectedPayment ? (
              <>
                <div className="vh-ledger-history-detail__hero">
                  <div>
                    <p className="vh-mvp-eyebrow">Selected Payment</p>
                    <strong>{selectedPayment.receivedLabel}</strong>
                    <p className="u-margin-b--none">
                      {selectedPayment.orderNumber ? `Order ${selectedPayment.orderNumber}` : "Direct payment record"}
                      {selectedPayment.productName ? ` · ${selectedPayment.productName}` : ""}
                    </p>
                    <p className="u-margin-b--none">
                      {selectedPayment.customerName || selectedPayment.email || "Customer not recorded"}
                    </p>
                  </div>
                  <div>
                    <p className="vh-mvp-eyebrow">Source Of Funds</p>
                    <strong>{selectedPayment.sourceTitle}</strong>
                    <p className="u-margin-b--none">{selectedPayment.sourceDetail}</p>
                    {selectedPayment.onChainLabel ? (
                      <p className="u-margin-b--none">On-chain receipt: {selectedPayment.onChainLabel}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="vh-mvp-eyebrow">Confirmed</p>
                    <strong>{formatDateTime(selectedPayment.paidAt)}</strong>
                    <p className="u-margin-b--none">Method: {selectedPayment.paymentMethodLabel}</p>
                  </div>
                </div>

                <div className="vh-ledger-history-detail__header">
                  <div>
                    <p className="vh-mvp-eyebrow">Allocation Detail</p>
                    <h3 className="h3 u-margin-b--sm">Where this payment was allocated.</h3>
                  </div>
                </div>

                <div className="vh-ledger-chip-grid">
                  {selectedPayment.allocations.length ? (
                    selectedPayment.allocations.map((allocation, index) => (
                      <div
                        key={allocation.id}
                        className="vh-ledger-chip vh-ledger-chip--interactive"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <div className="vh-ledger-chip__main">
                          <span className="vh-ledger-swatch" style={{ backgroundColor: allocation.color }} aria-hidden="true" />
                          <span>{allocation.name}</span>
                        </div>
                        <strong>{allocation.amountLabel}</strong>
                        {allocation.subAllocations.length ? (
                          <div className="vh-ledger-chip__sublist">
                            {allocation.subAllocations.map((subAllocation) => (
                              <span key={subAllocation.code}>
                                {subAllocation.name}: {subAllocation.amountLabel}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="vh-empty">No allocation rows are attached to this payment yet.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="vh-empty">Select a payment to inspect its fund allocation breakdown.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
