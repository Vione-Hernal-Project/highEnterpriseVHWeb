"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";

import { LedgerCashOutPanel } from "@/components/admin/ledger-cash-out-panel";
import { getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { formatLedgerCurrency, type AllocationLedgerSnapshot } from "@/lib/fund-allocation";

type Props = {
  initialSnapshot: AllocationLedgerSnapshot;
  role: string;
};

type StatusFilter = "all" | "confirmed" | "attention" | "payment" | "cash-out";

const CONFIRMED_STATUSES = new Set(["paid", "confirmed", "recorded", "complete", "completed"]);

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

function shiftDateKey(value: string, days: number) {
  const baseValue = value === "all" ? new Date().toISOString().slice(0, 10) : value;
  const date = new Date(`${baseValue}T00:00:00+08:00`);

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isConfirmedStatus(status: string) {
  return CONFIRMED_STATUSES.has(status.toLowerCase());
}

function getStatusClass(status: string) {
  return isConfirmedStatus(status) ? "vh-admin-ledger-pill--success" : "vh-admin-ledger-pill--warning";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(transaction: AllocationLedgerSnapshot["ledgerTransactions"][number], query: string) {
  if (!query) {
    return true;
  }

  return [
    transaction.eyebrow,
    transaction.title,
    transaction.amountLabel,
    transaction.methodLabel,
    transaction.statusLabel,
    transaction.occurredAtLabel,
    transaction.referenceLabel,
    transaction.chainLabel,
    transaction.walletLabel,
    transaction.allocationSummary,
  ].some((value) => value.toLowerCase().includes(query));
}

function matchesStatus(transaction: AllocationLedgerSnapshot["ledgerTransactions"][number], statusFilter: StatusFilter) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "confirmed") {
    return isConfirmedStatus(transaction.statusLabel);
  }

  if (statusFilter === "attention") {
    return !isConfirmedStatus(transaction.statusLabel) || transaction.allocationCount === 0;
  }

  return transaction.kind === statusFilter;
}

function LedgerKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  children,
}: {
  label: string;
  value?: string | number;
  meta: string;
  icon: typeof Activity;
  children?: ReactNode;
}) {
  return (
    <article className="vh-admin-ledger-kpi">
      <div className="vh-admin-ledger-kpi__icon">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        {children || <strong>{value}</strong>}
        <p>{meta}</p>
      </div>
    </article>
  );
}

export function AllocationLedger({ initialSnapshot, role }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(initialSnapshot.generatedAt);
  const [selectedDate, setSelectedDate] = useState(initialSnapshot.selectedDate.value);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
      const query = new URLSearchParams({
        ts: String(Date.now()),
        date: selectedDate,
      });
      const response = await fetch(`/api/admin/ledger?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJsonSafely<{ error?: string; snapshot?: AllocationLedgerSnapshot }>(response);

      if (!response.ok || !payload?.snapshot) {
        throw new Error(getResponseErrorMessage(payload, "Unable to refresh the allocation ledger."));
      }

      applySnapshotUpdate(payload.snapshot);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh the allocation ledger.");
    } finally {
      setRefreshing(false);
    }
  });

  function updateSelectedDate(nextDate: string) {
    if (nextDate !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      return;
    }

    setSelectedDate(nextDate);
    router.push(`/admin/ledger?date=${encodeURIComponent(nextDate)}`);
  }

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
    setSelectedDate(snapshot.selectedDate.value);
  }, [snapshot.selectedDate.value]);

  const selectedDayReceived = snapshot.latestPayments.reduce((total, payment) => total + payment.receivedAmount, 0);
  const selectedVolumeAmount = snapshot.selectedDate.isAll ? snapshot.summary.totalReceived : selectedDayReceived;
  const selectedDayConfirmedCount = snapshot.ledgerTransactions.filter((transaction) => isConfirmedStatus(transaction.statusLabel)).length;
  const selectedDayPendingCount = snapshot.ledgerTransactions.filter((transaction) => !isConfirmedStatus(transaction.statusLabel)).length;
  const selectedDayAttentionCount =
    selectedDayPendingCount + snapshot.ledgerTransactions.filter((transaction) => transaction.allocationCount === 0).length + snapshot.alerts.length;
  const walletBalanceLabel = snapshot.cashOut.withdrawableLabel || formatLedgerCurrency(snapshot.cashOut.withdrawableAmount, snapshot.cashOut.primaryCurrency);
  const allocationHealthLabel =
    snapshot.summary.activePercentageBasisPoints === 10000 && !snapshot.alerts.length ? "Healthy" : "Review";
  const allocationHealthMeta = `${snapshot.summary.activePercentageLabel} allocation model · ${snapshot.categories.length} buckets`;
  const normalizedSearchTerm = normalizeSearch(searchTerm);
  const filteredTransactions = useMemo(
    () =>
      snapshot.ledgerTransactions.filter((transaction) => {
        return matchesStatus(transaction, statusFilter) && matchesSearch(transaction, normalizedSearchTerm);
      }),
    [normalizedSearchTerm, snapshot.ledgerTransactions, statusFilter],
  );
  const dateLabel = snapshot.selectedDate.isAll
    ? "All ledger activity"
    : snapshot.selectedDate.isToday
      ? "Today"
      : snapshot.selectedDate.label;
  const viewLabel = snapshot.selectedDate.isAll ? "All Transactions" : snapshot.selectedDate.isToday ? "Today’s Ledger" : "Selected Day";

  return (
    <div className="vh-admin-ledger">
      <header className="vh-admin-ledger-header">
        <div>
          <p className="vh-admin-design-eyebrow">Ledger Command Center</p>
          <h1>Vione Hernal Ledger</h1>
          <p>
            Track confirmed on-chain payments, allocation movement, wallet balances, and owner cash-out activity from
            one private operating view.
          </p>
        </div>

        <div className="vh-admin-ledger-header__actions">
          <span className="vh-admin-ledger-live">
            <span aria-hidden="true" />
            {refreshing ? "Refreshing" : "Live Sync"}
          </span>

          <div className="vh-admin-ledger-date" aria-label="Ledger date selector">
            <button
              type="button"
              onClick={() => updateSelectedDate(shiftDateKey(selectedDate, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <label>
              <CalendarDays size={16} aria-hidden="true" />
              <input
                type="date"
                value={selectedDate === "all" ? "" : selectedDate}
                onChange={(event) => updateSelectedDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => updateSelectedDate(shiftDateKey(selectedDate, 1))}
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
            <button type="button" className="vh-admin-ledger-date__quick" onClick={() => updateSelectedDate(snapshot.selectedDate.todayValue)}>
              Today
            </button>
            <button type="button" className="vh-admin-ledger-date__quick" onClick={() => updateSelectedDate("all")}>
              All
            </button>
          </div>

          <button type="button" className="vh-admin-design-button" onClick={() => void refreshSnapshot()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "vh-ledger-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {snapshot.alerts.length ? (
        <div className="vh-admin-ledger-alert">
          {snapshot.alerts.map((alert) => (
            <p key={alert}>{alert}</p>
          ))}
        </div>
      ) : null}

      {error ? <div className="vh-admin-ledger-alert vh-admin-ledger-alert--error">{error}</div> : null}

      <section className="vh-admin-ledger-kpi-grid" aria-label="Ledger summary">
        <LedgerKpiCard
          label={snapshot.selectedDate.isToday ? "Today’s Confirmed Payments" : "Confirmed Payments"}
          value={selectedDayConfirmedCount}
          meta={`${snapshot.selectedDate.transactionCount} record${snapshot.selectedDate.transactionCount === 1 ? "" : "s"} in view`}
          icon={ShieldCheck}
        />
        <LedgerKpiCard
          label={snapshot.selectedDate.isToday ? "Today’s Revenue" : "Ledger Volume"}
          meta={snapshot.selectedDate.label}
          icon={CircleDollarSign}
        >
          <AnimatedAmount
            amount={selectedVolumeAmount}
            currency={snapshot.summary.primaryCurrency}
            className="vh-admin-ledger-kpi__value"
          />
        </LedgerKpiCard>
        <LedgerKpiCard
          label="Available Cash-Out Balance"
          value={walletBalanceLabel}
          meta={`${snapshot.cashOut.totalEvents} recorded cash-out event${snapshot.cashOut.totalEvents === 1 ? "" : "s"}`}
          icon={Wallet}
        />
        <LedgerKpiCard
          label="Pending Verification"
          value={selectedDayPendingCount + snapshot.cashOut.missingAllocationPaymentCount}
          meta={`${selectedDayAttentionCount} attention signal${selectedDayAttentionCount === 1 ? "" : "s"}`}
          icon={Clock3}
        />
        <LedgerKpiCard label="Allocation Health" value={allocationHealthLabel} meta={allocationHealthMeta} icon={Layers3} />
      </section>

      <div className="vh-admin-ledger-layout">
        <main className="vh-admin-ledger-main">
          <section className="vh-admin-ledger-panel vh-admin-ledger-panel--activity">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">{viewLabel}</p>
                <h2>{dateLabel}</h2>
                <span>
                  {filteredTransactions.length} visible of {snapshot.selectedDate.transactionCount} ledger transaction
                  {snapshot.selectedDate.transactionCount === 1 ? "" : "s"}
                </span>
              </div>
              <Link className="vh-admin-design-button vh-admin-design-button--ghost" href={`/admin/ledger/transactions?date=${encodeURIComponent(snapshot.selectedDate.value)}`}>
                Full History
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            <div className="vh-admin-ledger-filters">
              <label className="vh-admin-ledger-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search order, wallet, tx hash, chain..."
                />
              </label>
              <label className="vh-admin-ledger-select">
                <SlidersHorizontal size={16} aria-hidden="true" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="attention">Needs Attention</option>
                  <option value="payment">Payments</option>
                  <option value="cash-out">Cash-Outs</option>
                </select>
              </label>
            </div>

            <div className="vh-admin-ledger-table" role="table" aria-label="Ledger transactions">
              <div className="vh-admin-ledger-table__head" role="row">
                <span>Transaction</span>
                <span>Method</span>
                <span>Reference</span>
                <span>Status</span>
                <span>Amount</span>
                <span />
              </div>
              <div className="vh-admin-ledger-table__body">
                {filteredTransactions.length ? (
                  filteredTransactions.map((transaction) => (
                    <Link key={`${transaction.kind}-${transaction.id}`} href={transaction.href} className="vh-admin-ledger-row" role="row">
                      <div className="vh-admin-ledger-row__identity">
                        <span>{transaction.eyebrow}</span>
                        <strong>{transaction.title}</strong>
                        <small>{transaction.occurredAtLabel}</small>
                      </div>
                      <div>
                        <strong>{transaction.methodLabel}</strong>
                        <small>{transaction.chainLabel}</small>
                      </div>
                      <div>
                        <strong>{transaction.referenceLabel}</strong>
                        <small>{transaction.walletLabel}</small>
                      </div>
                      <div>
                        <span className={`vh-admin-ledger-pill ${getStatusClass(transaction.statusLabel)}`}>{transaction.statusLabel}</span>
                        <small>{transaction.allocationSummary}</small>
                      </div>
                      <div className="vh-admin-ledger-row__amount">
                        <strong>{transaction.amountLabel}</strong>
                      </div>
                      <div className="vh-admin-ledger-row__cta">
                        View
                        <ArrowRight size={14} aria-hidden="true" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="vh-admin-ledger-empty">
                    <Clock3 size={22} aria-hidden="true" />
                    <strong>No ledger transactions found.</strong>
                    <p>Adjust the filter, search term, or calendar date to inspect another activity window.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="vh-admin-ledger-panel">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Allocation Breakdown</p>
                <h2>Business routing model</h2>
                <span>{snapshot.summary.activePercentageLabel} active distribution across confirmed payment value</span>
              </div>
              <Link className="vh-admin-design-button vh-admin-design-button--ghost" href="/admin/ledger/distribution">
                View Rules
              </Link>
            </div>

            <div className="vh-admin-ledger-allocation-bar" aria-label="Allocation bucket percentages">
              {snapshot.categories.map((category) => (
                <span
                  key={category.id}
                  style={{
                    width: `${Math.max(0, category.percentageBasisPoints / 100)}%`,
                    backgroundColor: category.color,
                  }}
                  title={`${category.name} ${category.percentageLabel}`}
                />
              ))}
            </div>

            <div className="vh-admin-ledger-allocation-grid">
              {snapshot.categories.length ? (
                snapshot.categories.map((category) => (
                  <article key={category.id} className="vh-admin-ledger-allocation-card">
                    <div>
                      <i style={{ backgroundColor: category.color }} aria-hidden="true" />
                      <span>{category.percentageLabel}</span>
                    </div>
                    <strong>{category.name}</strong>
                    <p>{category.lead || category.description || "Allocation category"}</p>
                    <dl>
                      <div>
                        <dt>Allocated</dt>
                        <dd>{category.totalAllocatedLabel}</dd>
                      </div>
                      <div>
                        <dt>Withdrawable</dt>
                        <dd>{category.withdrawableAmountLabel}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              ) : (
                <div className="vh-admin-ledger-empty">No allocation categories are active yet.</div>
              )}
            </div>
          </section>
        </main>

        <aside className="vh-admin-ledger-side">
          <section className="vh-admin-ledger-panel vh-admin-ledger-panel--treasury">
            <p className="vh-admin-design-eyebrow">Treasury Balance</p>
            <h2>{walletBalanceLabel}</h2>
            <p>
              Withdrawable confirmed balance from the configured merchant wallet and allocation buckets. Pending and
              failed payment records remain excluded.
            </p>
            <div className="vh-admin-ledger-mini-list">
              {snapshot.cashOut.assets.slice(0, 4).map((asset) => (
                <div key={asset.paymentMethod}>
                  <span>{asset.currency}</span>
                  <strong>{asset.withdrawableAmountLabel}</strong>
                </div>
              ))}
              {!snapshot.cashOut.assets.length ? <div>No cash-out assets available.</div> : null}
            </div>
          </section>

          <LedgerCashOutPanel snapshot={snapshot} onSnapshotUpdate={applySnapshotUpdate} />

          <section className="vh-admin-ledger-panel">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Payment Rails</p>
                <h2>Chain coverage</h2>
              </div>
            </div>
            <div className="vh-admin-ledger-mini-list">
              {snapshot.currentPaymentModes.map((mode) => (
                <div key={mode.code}>
                  <span>{mode.title}</span>
                  <strong>{mode.status}</strong>
                  <small>{mode.description}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="vh-admin-ledger-panel">
            <div className="vh-admin-ledger-panel__header">
              <div>
                <p className="vh-admin-design-eyebrow">Currency Watch</p>
                <h2>Ledger exposure</h2>
              </div>
            </div>
            <div className="vh-admin-ledger-mini-list">
              {snapshot.summary.currencyTotals.map((currencyTotal) => (
                <div key={currencyTotal.currency}>
                  <span>{currencyTotal.currency}</span>
                  <strong>{currencyTotal.label}</strong>
                </div>
              ))}
            </div>
            <p className="vh-admin-ledger-sync">
              <RefreshCw size={13} className={refreshing ? "vh-ledger-spin" : ""} aria-hidden="true" />
              Synced {formatDateTime(lastSyncedAt)} · {role} access
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
