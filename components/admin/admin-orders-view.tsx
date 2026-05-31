"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { AdminPageHeader, AdminStatusBadge, EmptyAdminState } from "@/components/admin/admin-ui";
import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { cn } from "@/lib/utils";

export type AdminOrderViewRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  dateLabel: string;
  amountLabel: string;
  status: string;
  initialStatus: string;
  itemCount: number;
  detailHref: string;
  paymentMethodLabel: string;
  tokenLabel: string;
  transactionLabel: string;
  paymentDetailHref: string | null;
};

type Props = {
  rows: AdminOrderViewRow[];
  role: string;
  canUpdateOrders: boolean;
  canViewPaymentDetails: boolean;
  loadError?: string;
};

type StatusFilter = "all" | "pending" | "processing" | "confirmed" | "delivered" | "cancelled";
type DateRangeFilter = "today" | "last7" | "last30" | "month" | "all" | "custom";
type PaymentStatusFilter = "all" | "paid" | "pending" | "cancelled" | "none";
type SortOption = "newest" | "oldest" | "value-desc" | "value-asc" | "customer-asc";
type AdvancedOrderFilters = {
  dateRange: DateRangeFilter;
  dateFrom: string;
  dateTo: string;
  orderStatuses: StatusFilter[];
  paymentMethod: string;
  paymentStatus: PaymentStatusFilter;
  customer: string;
  minAmount: string;
  maxAmount: string;
  sortBy: SortOption;
};

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All Orders" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const DATE_OPTIONS: Array<{ key: Exclude<DateRangeFilter, "custom">; label: string }> = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

const DRAWER_DATE_OPTIONS: Array<{ key: DateRangeFilter; label: string }> = [
  ...DATE_OPTIONS,
  { key: "custom", label: "Custom range" },
];

const ORDER_STATUS_FILTER_OPTIONS = STATUS_OPTIONS.filter((option) => option.key !== "all");

const PAYMENT_STATUS_OPTIONS: Array<{ key: PaymentStatusFilter; label: string }> = [
  { key: "all", label: "All Statuses" },
  { key: "paid", label: "Paid / confirmed" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
  { key: "none", label: "No payment record" },
];

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "value-desc", label: "Highest value" },
  { key: "value-asc", label: "Lowest value" },
  { key: "customer-asc", label: "Customer A-Z" },
];

const DEFAULT_ADVANCED_FILTERS: AdvancedOrderFilters = {
  dateRange: "all",
  dateFrom: "",
  dateTo: "",
  orderStatuses: [],
  paymentMethod: "all",
  paymentStatus: "all",
  customer: "",
  minAmount: "",
  maxAmount: "",
  sortBy: "newest",
};

const ORDER_DATE_TIME_ZONE = "Asia/Manila";
const orderDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ORDER_DATE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getOrderDateKey(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = orderDateFormatter.formatToParts(date);

  return `${parts.find((part) => part.type === "year")?.value || "1970"}-${
    parts.find((part) => part.type === "month")?.value || "01"
  }-${parts.find((part) => part.type === "day")?.value || "01"}`;
}

function getTodayDateKey() {
  return getOrderDateKey(new Date());
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return getOrderDateKey(date);
}

function matchesDateRange(createdAt: string, range: DateRangeFilter, dateFrom = "", dateTo = "") {
  if (range === "custom") {
    const orderDateKey = getOrderDateKey(createdAt);

    if (!orderDateKey) {
      return false;
    }

    if (dateFrom && orderDateKey < dateFrom) {
      return false;
    }

    if (dateTo && orderDateKey > dateTo) {
      return false;
    }

    return true;
  }

  if (range === "all") {
    return true;
  }

  const orderDateKey = getOrderDateKey(createdAt);
  const todayKey = getTodayDateKey();

  if (!orderDateKey) {
    return false;
  }

  if (range === "today") {
    return orderDateKey === todayKey;
  }

  let rangeStartKey = todayKey;

  if (range === "last7") {
    rangeStartKey = shiftDateKey(todayKey, -6);
  }

  if (range === "last30") {
    rangeStartKey = shiftDateKey(todayKey, -29);
  }

  if (range === "month") {
    rangeStartKey = `${todayKey.slice(0, 8)}01`;
  }

  return orderDateKey >= rangeStartKey && orderDateKey <= todayKey;
}

function parseAmountValue(amountLabel: string) {
  const match = amountLabel.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseFilterAmount(value: string) {
  if (!value.trim()) {
    return null;
  }

  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : null;
}

function matchesStatus(row: AdminOrderViewRow, status: StatusFilter) {
  if (status === "all") {
    return true;
  }

  if (status === "pending") {
    return row.status === "pending";
  }

  if (status === "confirmed" || status === "delivered") {
    return row.status === "paid";
  }

  if (status === "cancelled") {
    return row.status === "cancelled";
  }

  return !["pending", "paid", "cancelled"].includes(row.status);
}

function getStatusTone(status: string): "paid" | "processing" | "pending" | "cancelled" | "shipped" {
  if (status === "paid") {
    return "paid";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "pending") {
    return "pending";
  }

  return "processing";
}

function escapeCsvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsv(rows: AdminOrderViewRow[]) {
  const headers = ["Order ID", "Customer", "Email", "Date", "Total", "Payment", "Token", "Transaction", "Status"];
  const lines = rows.map((row) => [
    row.orderNumber,
    row.customerName,
    row.customerEmail,
    row.dateLabel,
    row.amountLabel,
    row.paymentMethodLabel,
    row.tokenLabel,
    row.transactionLabel,
    row.status,
  ]);

  return [headers, ...lines].map((line) => line.map(escapeCsvValue).join(",")).join("\n");
}

function getSearchValue(row: AdminOrderViewRow) {
  return [
    row.orderNumber,
    row.id,
    row.customerName,
    row.customerEmail,
    row.amountLabel,
    row.paymentMethodLabel,
    row.tokenLabel,
    row.transactionLabel,
    row.status,
  ]
    .join(" ")
    .toLowerCase();
}

function getPaymentStatus(row: AdminOrderViewRow): PaymentStatusFilter {
  if (!row.paymentDetailHref) {
    return "none";
  }

  if (row.status === "paid") {
    return "paid";
  }

  if (row.status === "cancelled") {
    return "cancelled";
  }

  return "pending";
}

function sortOrderRows(rows: AdminOrderViewRow[], sortBy: SortOption) {
  const sortedRows = [...rows];

  if (sortBy === "oldest") {
    return sortedRows.sort((firstRow, secondRow) => new Date(firstRow.createdAt).getTime() - new Date(secondRow.createdAt).getTime());
  }

  if (sortBy === "value-desc") {
    return sortedRows.sort((firstRow, secondRow) => (parseAmountValue(secondRow.amountLabel) ?? 0) - (parseAmountValue(firstRow.amountLabel) ?? 0));
  }

  if (sortBy === "value-asc") {
    return sortedRows.sort((firstRow, secondRow) => (parseAmountValue(firstRow.amountLabel) ?? 0) - (parseAmountValue(secondRow.amountLabel) ?? 0));
  }

  if (sortBy === "customer-asc") {
    return sortedRows.sort((firstRow, secondRow) => firstRow.customerName.localeCompare(secondRow.customerName));
  }

  return sortedRows.sort((firstRow, secondRow) => new Date(secondRow.createdAt).getTime() - new Date(firstRow.createdAt).getTime());
}

function countActiveAdvancedFilters(filters: AdvancedOrderFilters) {
  return [
    filters.dateRange !== "all",
    filters.orderStatuses.length > 0,
    filters.paymentMethod !== "all",
    filters.paymentStatus !== "all",
    filters.customer.trim().length > 0,
    filters.minAmount.trim().length > 0 || filters.maxAmount.trim().length > 0,
    filters.sortBy !== "newest",
  ].filter(Boolean).length;
}

function MetricCard({
  label,
  value,
  delta,
  tone = "purple",
  icon: Icon,
  active,
}: {
  label: string;
  value: string | number;
  delta: string;
  tone?: "purple" | "green" | "blue" | "gold" | "rose";
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <article className={cn("vh-admin-stat-card", `vh-admin-stat-card--${tone}`, active && "vh-admin-stat-card--selected")}>
      <span className="vh-admin-stat-card__icon">
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="vh-admin-stat-card__content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta}</small>
      </span>
    </article>
  );
}

export function AdminOrdersView({ rows, role, canUpdateOrders, canViewPaymentDetails, loadError = "" }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedOrderFilters>(DEFAULT_ADVANCED_FILTERS);
  const [draftFilters, setDraftFilters] = useState<AdvancedOrderFilters>(DEFAULT_ADVANCED_FILTERS);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const dateRange = advancedFilters.dateRange;

  const selectedDateLabel = DRAWER_DATE_OPTIONS.find((option) => option.key === dateRange)?.label || "All time";
  const paymentMethodOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.paymentMethodLabel).filter(Boolean))).sort((firstMethod, secondMethod) => firstMethod.localeCompare(secondMethod))
  ), [rows]);
  const draftFilterCount = countActiveAdvancedFilters(draftFilters);

  const baseFilteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCustomer = advancedFilters.customer.trim().toLowerCase();
    const minAmount = parseFilterAmount(advancedFilters.minAmount);
    const maxAmount = parseFilterAmount(advancedFilters.maxAmount);

    return rows.filter((row) => {
      const matchesText = normalizedSearch ? getSearchValue(row).includes(normalizedSearch) : true;
      const matchesDrawerStatus = advancedFilters.orderStatuses.length
        ? advancedFilters.orderStatuses.some((status) => matchesStatus(row, status))
        : true;
      const matchesPaymentMethod = advancedFilters.paymentMethod === "all" || row.paymentMethodLabel === advancedFilters.paymentMethod;
      const matchesPaymentStatus = advancedFilters.paymentStatus === "all" || getPaymentStatus(row) === advancedFilters.paymentStatus;
      const matchesCustomer = normalizedCustomer
        ? `${row.customerName} ${row.customerEmail}`.toLowerCase().includes(normalizedCustomer)
        : true;
      const amountValue = parseAmountValue(row.amountLabel);
      const matchesMinAmount = minAmount === null || (amountValue !== null && amountValue >= minAmount);
      const matchesMaxAmount = maxAmount === null || (amountValue !== null && amountValue <= maxAmount);

      return (
        matchesText
        && matchesDrawerStatus
        && matchesDateRange(row.createdAt, advancedFilters.dateRange, advancedFilters.dateFrom, advancedFilters.dateTo)
        && matchesPaymentMethod
        && matchesPaymentStatus
        && matchesCustomer
        && matchesMinAmount
        && matchesMaxAmount
      );
    });
  }, [advancedFilters, rows, search]);

  const counts = useMemo(() => ({
    all: baseFilteredRows.length,
    pending: baseFilteredRows.filter((row) => matchesStatus(row, "pending")).length,
    processing: baseFilteredRows.filter((row) => matchesStatus(row, "processing")).length,
    confirmed: baseFilteredRows.filter((row) => matchesStatus(row, "confirmed")).length,
    delivered: baseFilteredRows.filter((row) => matchesStatus(row, "delivered")).length,
    cancelled: baseFilteredRows.filter((row) => matchesStatus(row, "cancelled")).length,
  }), [baseFilteredRows]);

  const filteredRows = useMemo(() => (
    sortOrderRows(baseFilteredRows.filter((row) => matchesStatus(row, statusFilter)), advancedFilters.sortBy)
  ), [advancedFilters.sortBy, baseFilteredRows, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const visibleRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const visibleIds = visibleRows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.includes(id));
  const showingStart = filteredRows.length ? (page - 1) * rowsPerPage + 1 : 0;
  const showingEnd = Math.min(page * rowsPerPage, filteredRows.length);

  useEffect(() => {
    setPage(1);
    setSelectedOrderIds([]);
  }, [advancedFilters, rowsPerPage, search, statusFilter]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!filtersOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtersOpen]);

  const updateStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    setFiltersOpen(false);
  };

  const updateDateRangeFilter = (nextDateRange: Exclude<DateRangeFilter, "custom">) => {
    setAdvancedFilters((currentFilters) => ({
      ...currentFilters,
      dateRange: nextDateRange,
      dateFrom: "",
      dateTo: "",
    }));
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      dateRange: nextDateRange,
      dateFrom: "",
      dateTo: "",
    }));
    setDateMenuOpen(false);
  };

  const openFilterDrawer = () => {
    setDraftFilters(advancedFilters);
    setDateMenuOpen(false);
    setFiltersOpen(true);
  };

  const toggleDraftStatus = (status: StatusFilter) => {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      orderStatuses: currentFilters.orderStatuses.includes(status)
        ? currentFilters.orderStatuses.filter((currentStatus) => currentStatus !== status)
        : [...currentFilters.orderStatuses, status],
    }));
  };

  const applyDrawerFilters = () => {
    setAdvancedFilters(draftFilters);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setDraftFilters(DEFAULT_ADVANCED_FILTERS);
    setSearch("");
  };

  const exportOrders = () => {
    const csv = buildCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vione-hernal-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Orders" subtitle="Manage orders, payment confirmation, ledger references, and fulfillment status.">
        <label className="vh-admin-search vh-admin-header-search">
          <Search size={16} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID, customer or email..."
          />
        </label>
        <button className="vh-admin-action-button" type="button" onClick={exportOrders}>
          <Download size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Export</span>
        </button>
        <div className="vh-admin-range-control">
          <button
            className="vh-admin-action-button"
            type="button"
            onClick={() => setDateMenuOpen((isOpen) => !isOpen)}
            aria-expanded={dateMenuOpen}
          >
            <CalendarDays size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{selectedDateLabel}</span>
          </button>
          {dateMenuOpen ? (
            <div className="vh-admin-range-menu" role="menu">
              {DATE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={cn(option.key === dateRange && "is-active")}
                  type="button"
                  onClick={() => updateDateRangeFilter(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="vh-admin-action-button vh-admin-action-button--primary" type="button" onClick={openFilterDrawer} aria-haspopup="dialog" aria-expanded={filtersOpen}>
          <Filter size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Filter</span>
        </button>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--six" aria-label="Order metrics">
        <MetricCard label="Total Orders" value={counts.all} delta="↑ live order records" icon={ShoppingBag} active={statusFilter === "all"} />
        <MetricCard label="Pending" value={counts.pending} delta="↑ waiting action" tone="gold" icon={Clock3} active={statusFilter === "pending"} />
        <MetricCard label="Processing" value={counts.processing} delta="↑ open queue" tone="blue" icon={RotateCcw} active={statusFilter === "processing"} />
        <MetricCard label="Confirmed" value={counts.confirmed} delta="↑ on-chain verified" tone="green" icon={PackageCheck} active={statusFilter === "confirmed"} />
        <MetricCard label="Delivered" value={counts.delivered} delta="fulfillment ready" tone="purple" icon={Truck} active={statusFilter === "delivered"} />
        <MetricCard label="Cancelled" value={counts.cancelled} delta="order cancellations" tone="rose" icon={XCircle} active={statusFilter === "cancelled"} />
      </section>

      <section className="vh-admin-table-card">
        <div className="vh-admin-tabs" role="tablist" aria-label="Order status">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={cn("vh-admin-tab", option.key === statusFilter && "vh-admin-tab--active")}
              type="button"
              role="tab"
              aria-selected={option.key === statusFilter}
              onClick={() => updateStatusFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="vh-admin-table-scroll">
          <table className="vh-admin-table vh-admin-table--orders">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible orders"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      setSelectedOrderIds((currentIds) => {
                        if (!event.target.checked) {
                          return currentIds.filter((id) => !visibleIds.includes(id));
                        }

                        return Array.from(new Set([...currentIds, ...visibleIds]));
                      });
                    }}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Payment / Ledger</th>
                <th>Status</th>
                <th>Fulfillment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${row.orderNumber}`}
                        checked={selectedOrderIds.includes(row.id)}
                        onChange={(event) => {
                          setSelectedOrderIds((currentIds) => (
                            event.target.checked ? [...currentIds, row.id] : currentIds.filter((id) => id !== row.id)
                          ));
                        }}
                      />
                    </td>
                    <td>
                      <Link className="vh-admin-table__link" href={row.detailHref}>
                        #{row.orderNumber}
                      </Link>
                      <span>{row.itemCount} item{row.itemCount === 1 ? "" : "s"}</span>
                    </td>
                    <td>
                      <div className="vh-admin-customer-cell">
                        <div aria-hidden="true">{row.customerName.slice(0, 1).toUpperCase()}</div>
                        <span>
                          <strong>{row.customerName}</strong>
                          <small>{row.customerEmail}</small>
                        </span>
                      </div>
                    </td>
                    <td>{row.dateLabel}</td>
                    <td>{row.amountLabel}</td>
                    <td>
                      {canViewPaymentDetails && row.paymentDetailHref ? (
                        <div className="vh-admin-payment-cell">
                          <strong>{row.paymentMethodLabel}</strong>
                          <small>{row.tokenLabel} · {row.transactionLabel}</small>
                        </div>
                      ) : (
                        <span className="vh-admin-muted">{canViewPaymentDetails ? "No payment record" : "Restricted"}</span>
                      )}
                    </td>
                    <td><AdminStatusBadge tone={getStatusTone(row.status)}>{row.status}</AdminStatusBadge></td>
                    <td><AdminStatusBadge tone={row.status === "paid" ? "shipped" : "pending"}>{row.status === "paid" ? "Ready" : "Pending"}</AdminStatusBadge></td>
                    <td>
                      <div className="vh-admin-row-actions">
                        <Link className="vh-admin-view-button" href={row.detailHref}>
                          View
                        </Link>
                        {canUpdateOrders && !(role === "orders_manager" && row.status === "paid") ? (
                          <AdminOrderStatusForm
                            orderId={row.id}
                            initialStatus={row.initialStatus}
                            allowedStatuses={role === "orders_manager" ? ["pending", "cancelled"] : undefined}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyAdminState title="No matching orders." copy="Adjust the search, status, or date filters to see more order records." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="vh-admin-pagination">
          <span>Showing {showingStart} to {showingEnd} of {filteredRows.length} orders</span>
          <div>
            <button type="button" className="vh-admin-page-button" disabled={page === 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} aria-label="Previous page">
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.max(5, page + 2)).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={cn("vh-admin-page-button", pageNumber === page && "vh-admin-page-button--active")}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button type="button" className="vh-admin-page-button" disabled={page === pageCount} onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))} aria-label="Next page">
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          <label className="vh-admin-rows-select">
            <span>Rows per page:</span>
            <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
      </section>

      {filtersOpen ? (
        <div className="vh-admin-filter-drawer-shell">
          <button className="vh-admin-filter-drawer-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
          <aside className="vh-admin-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="orders-filter-title">
            <header className="vh-admin-filter-drawer__header">
              <h2 id="orders-filter-title">Filter Orders</h2>
              <button className="vh-admin-filter-drawer__close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X size={18} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </header>

            <div className="vh-admin-filter-drawer__body">
              <label className="vh-admin-filter-field">
                <span>Date range</span>
                <span className="vh-admin-filter-select">
                  <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" />
                  <select
                    value={draftFilters.dateRange}
                    onChange={(event) => {
                      const nextDateRange = event.target.value as DateRangeFilter;
                      setDraftFilters((currentFilters) => ({
                        ...currentFilters,
                        dateRange: nextDateRange,
                        dateFrom: nextDateRange === "custom" ? currentFilters.dateFrom : "",
                        dateTo: nextDateRange === "custom" ? currentFilters.dateTo : "",
                      }));
                    }}
                  >
                    {DRAWER_DATE_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <div className="vh-admin-filter-grid">
                <label className="vh-admin-filter-field">
                  <span>From</span>
                  <input
                    type="date"
                    value={draftFilters.dateFrom}
                    onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, dateRange: "custom", dateFrom: event.target.value }))}
                  />
                </label>
                <label className="vh-admin-filter-field">
                  <span>To</span>
                  <input
                    type="date"
                    value={draftFilters.dateTo}
                    onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, dateRange: "custom", dateTo: event.target.value }))}
                  />
                </label>
              </div>

              <fieldset className="vh-admin-filter-field vh-admin-filter-fieldset">
                <legend>Order status</legend>
                <div className="vh-admin-status-multiselect">
                  <div className="vh-admin-status-multiselect__label">
                    <span>{draftFilters.orderStatuses.length ? `${draftFilters.orderStatuses.length} selected` : "Select status"}</span>
                    <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                  </div>
                  <div className="vh-admin-status-options">
                    {ORDER_STATUS_FILTER_OPTIONS.map((option) => (
                      <label key={option.key} className="vh-admin-status-option">
                        <input
                          type="checkbox"
                          checked={draftFilters.orderStatuses.includes(option.key)}
                          onChange={() => toggleDraftStatus(option.key)}
                        />
                        <span className="vh-admin-status-check">
                          <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                        </span>
                        <span className={`vh-admin-status-dot vh-admin-status-dot--${option.key}`} aria-hidden="true" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              <label className="vh-admin-filter-field">
                <span>Payment method</span>
                <span className="vh-admin-filter-select">
                  <select value={draftFilters.paymentMethod} onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, paymentMethod: event.target.value }))}>
                    <option value="all">Select payment method</option>
                    {paymentMethodOptions.map((paymentMethod) => (
                      <option key={paymentMethod} value={paymentMethod}>
                        {paymentMethod}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <label className="vh-admin-filter-field">
                <span>Payment status</span>
                <span className="vh-admin-filter-select">
                  <select
                    value={draftFilters.paymentStatus}
                    onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, paymentStatus: event.target.value as PaymentStatusFilter }))}
                  >
                    {PAYMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>

              <label className="vh-admin-filter-field">
                <span>Customer</span>
                <input
                  type="search"
                  value={draftFilters.customer}
                  onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, customer: event.target.value }))}
                  placeholder="Search customer name or email..."
                />
              </label>

              <div className="vh-admin-filter-field">
                <span>Order value</span>
                <div className="vh-admin-filter-grid">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={draftFilters.minAmount}
                    onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, minAmount: event.target.value }))}
                    placeholder="Min amount"
                    aria-label="Minimum order value"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={draftFilters.maxAmount}
                    onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, maxAmount: event.target.value }))}
                    placeholder="Max amount"
                    aria-label="Maximum order value"
                  />
                </div>
              </div>

              <label className="vh-admin-filter-field">
                <span>Sort by</span>
                <span className="vh-admin-filter-select">
                  <select value={draftFilters.sortBy} onChange={(event) => setDraftFilters((currentFilters) => ({ ...currentFilters, sortBy: event.target.value as SortOption }))}>
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </label>
            </div>

            <footer className="vh-admin-filter-drawer__footer">
              <button className="vh-admin-filter-drawer__reset" type="button" onClick={resetFilters}>
                Reset Filters
              </button>
              <button className="vh-admin-filter-drawer__apply" type="button" onClick={applyDrawerFilters}>
                <Filter size={15} strokeWidth={1.9} aria-hidden="true" />
                <span>Apply Filters</span>
                {draftFilterCount ? <b>{draftFilterCount}</b> : null}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      <div className="vh-admin-context-note">
        Effective role: {role}. {canUpdateOrders ? "Order actions are available." : "Order records are view-only."}
      </div>
    </div>
  );
}
