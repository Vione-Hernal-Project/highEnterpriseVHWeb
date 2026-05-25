"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, History, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AllocationLedgerSnapshot } from "@/lib/fund-allocation";
import { formatDateTime } from "@/lib/utils";

type Props = {
  initialSnapshot: AllocationLedgerSnapshot;
};

type StatusFilter = "all" | "confirmed" | "attention" | "payment" | "cash-out";

const CONFIRMED_STATUSES = new Set(["paid", "confirmed", "recorded", "complete", "completed"]);

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

function matchesSearch(transaction: AllocationLedgerSnapshot["ledgerTransactions"][number], searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();

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

export function LedgerTransactionHistory({ initialSnapshot }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialSnapshot.selectedDate.value);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setSelectedDate(initialSnapshot.selectedDate.value);
  }, [initialSnapshot.selectedDate.value]);

  function updateSelectedDate(nextDate: string) {
    if (nextDate !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      return;
    }

    setSelectedDate(nextDate);
    router.push(`/admin/ledger/transactions?date=${encodeURIComponent(nextDate)}`);
  }

  const filteredTransactions = useMemo(
    () =>
      initialSnapshot.ledgerTransactions.filter((transaction) => {
        return matchesStatus(transaction, statusFilter) && matchesSearch(transaction, searchTerm);
      }),
    [initialSnapshot.ledgerTransactions, searchTerm, statusFilter],
  );

  return (
    <div className="vh-admin-ledger">
      <header className="vh-admin-ledger-header">
        <div>
          <p className="vh-admin-design-eyebrow">Transaction History</p>
          <h1>Ledger Movement</h1>
          <p>
            Review payments and cash-outs by day. Every record opens into the full chain, wallet, order, quote, and
            allocation detail view.
          </p>
        </div>

        <div className="vh-admin-ledger-header__actions">
          <div className="vh-admin-ledger-date" aria-label="Ledger transaction date selector">
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
            <button type="button" className="vh-admin-ledger-date__quick" onClick={() => updateSelectedDate(initialSnapshot.selectedDate.todayValue)}>
              Today
            </button>
            <button type="button" className="vh-admin-ledger-date__quick" onClick={() => updateSelectedDate("all")}>
              All
            </button>
          </div>
          <Link className="vh-admin-design-button vh-admin-design-button--ghost" href="/admin/orders">
            Back To Orders
          </Link>
        </div>
      </header>

      <section className="vh-admin-ledger-kpi-grid vh-admin-ledger-kpi-grid--compact" aria-label="Selected day transaction summary">
        <article className="vh-admin-ledger-kpi">
          <div className="vh-admin-ledger-kpi__icon">
            <History size={18} aria-hidden="true" />
          </div>
          <div>
            <span>{initialSnapshot.selectedDate.isAll ? "All Transactions" : "Selected Transactions"}</span>
            <strong>{initialSnapshot.selectedDate.transactionCount}</strong>
            <p>{initialSnapshot.selectedDate.label}</p>
          </div>
        </article>
        <article className="vh-admin-ledger-kpi">
          <div className="vh-admin-ledger-kpi__icon">
            <RefreshCw size={18} aria-hidden="true" />
          </div>
          <div>
            <span>Snapshot Synced</span>
            <strong>{formatDateTime(initialSnapshot.generatedAt)}</strong>
            <p>Existing ledger data source</p>
          </div>
        </article>
      </section>

      <section className="vh-admin-ledger-panel vh-admin-ledger-panel--activity">
        <div className="vh-admin-ledger-panel__header">
          <div>
            <p className="vh-admin-design-eyebrow">History View</p>
            <h2>
              {initialSnapshot.selectedDate.label} · {filteredTransactions.length} visible
            </h2>
            <span>Use the calendar, status filter, or search field to inspect a focused transaction set.</span>
          </div>
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

        <div className="vh-admin-ledger-table" role="table" aria-label="Ledger transaction history">
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
                <p>Choose another date or clear the filters to inspect more ledger activity.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
