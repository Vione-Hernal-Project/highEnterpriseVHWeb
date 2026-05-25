"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Crown, Filter, Mail, Search, UserPlus, Users } from "lucide-react";

import { AdminStatCard, AdminStatusBadge } from "@/components/admin/admin-ui";
import { cn, formatDateTime } from "@/lib/utils";

export type AdminCustomerListRow = {
  key: string;
  name: string;
  email: string;
  orders: number;
  paidOrders: number;
  totalSpent: number;
  latestAt: string;
  location: string;
  phone: string;
  accountStatus: "active" | "inactive" | "blocked";
  isSubscribed: boolean;
};

type Props = {
  customers: AdminCustomerListRow[];
  initialTab: CustomerTab;
};

export type CustomerTab = "All Customers" | "New Customers" | "Repeat Customers" | "Subscribed" | "Guest Customers";
type DateRangeFilter = "today" | "last7" | "last30" | "month" | "all";
type AccountStatusFilter = "all" | "active" | "inactive" | "blocked";

const CUSTOMER_TABLE_TABS: CustomerTab[] = ["All Customers", "New Customers", "Repeat Customers", "Subscribed", "Guest Customers"];
const DATE_OPTIONS: Array<{ key: DateRangeFilter; label: string }> = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];
const ADMIN_TIME_ZONE = "Asia/Manila";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getDateKey(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${parts.find((part) => part.type === "year")?.value || "1970"}-${
    parts.find((part) => part.type === "month")?.value || "01"
  }-${parts.find((part) => part.type === "day")?.value || "01"}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

function matchesDateRange(value: string | null | undefined, range: DateRangeFilter) {
  if (range === "all") {
    return true;
  }

  const dateKey = getDateKey(value);
  const todayKey = getDateKey(new Date());

  if (!dateKey) {
    return false;
  }

  if (range === "today") {
    return dateKey === todayKey;
  }

  let startKey = todayKey;

  if (range === "last7") {
    startKey = shiftDateKey(todayKey, -6);
  }

  if (range === "last30") {
    startKey = shiftDateKey(todayKey, -29);
  }

  if (range === "month") {
    startKey = `${todayKey.slice(0, 8)}01`;
  }

  return dateKey >= startKey && dateKey <= todayKey;
}

function matchesCustomerTab(customer: AdminCustomerListRow, tab: CustomerTab) {
  if (tab === "New Customers") {
    return customer.orders > 0;
  }

  if (tab === "Repeat Customers") {
    return customer.orders > 1;
  }

  if (tab === "Subscribed") {
    return customer.isSubscribed;
  }

  if (tab === "Guest Customers") {
    return !customer.isSubscribed;
  }

  return true;
}

export function AdminCustomersView({ customers, initialTab }: Props) {
  const [selectedTab, setSelectedTab] = useState<CustomerTab>(initialTab);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dateFilteredCustomers = useMemo(
    () => customers.filter((customer) => matchesDateRange(customer.latestAt, dateRange)),
    [customers, dateRange],
  );
  const normalizedSearch = normalize(search);
  const filteredCustomers = useMemo(() => (
    dateFilteredCustomers.filter((customer) => {
      const matchesTab = matchesCustomerTab(customer, selectedTab);
      const matchesStatus = statusFilter === "all" || customer.accountStatus === statusFilter;
      const matchesSearch = normalizedSearch
        ? normalize(`${customer.name} ${customer.email} ${customer.phone} ${customer.location}`).includes(normalizedSearch)
        : true;

      return matchesTab && matchesStatus && matchesSearch;
    })
  ), [dateFilteredCustomers, normalizedSearch, selectedTab, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage));
  const visibleCustomers = filteredCustomers.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const visibleIds = visibleCustomers.map((customer) => customer.key);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const metrics = {
    total: dateFilteredCustomers.length,
    new: dateFilteredCustomers.filter((customer) => customer.orders > 0).length,
    repeat: dateFilteredCustomers.filter((customer) => customer.orders > 1).length,
    subscribed: dateFilteredCustomers.filter((customer) => customer.isSubscribed).length,
  };
  const showingStart = filteredCustomers.length ? (page - 1) * rowsPerPage + 1 : 0;
  const showingEnd = Math.min(page * rowsPerPage, filteredCustomers.length);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, normalizedSearch, rowsPerPage, selectedTab, statusFilter]);

  useEffect(() => {
    setSelectedIds((currentIds) => currentIds.filter((id) => filteredCustomers.some((customer) => customer.key === id)));
  }, [filteredCustomers]);

  const selectTab = (tab: CustomerTab) => {
    setSelectedTab(tab);
    const params = new URLSearchParams(window.location.search);

    if (tab === CUSTOMER_TABLE_TABS[0]) {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const resetFilters = () => {
    selectTab(CUSTOMER_TABLE_TABS[0]);
    setSearch("");
    setDateRange("all");
    setStatusFilter("all");
    setFilterOpen(false);
  };

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((currentIds) => currentIds.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((currentIds) => Array.from(new Set([...currentIds, ...visibleIds])));
  };

  return (
    <>
      <section className="vh-admin-stats-grid vh-admin-stats-grid--four" aria-label="Customer metrics">
        <AdminStatCard label="Total Customers" value={metrics.total} delta="↑ known customer records" icon={Users} active={selectedTab === "All Customers"} />
        <AdminStatCard label="New Customers" value={metrics.new} delta="↑ order contacts" tone="blue" icon={UserPlus} active={selectedTab === "New Customers"} />
        <AdminStatCard label="Repeat Customers" value={metrics.repeat} delta="↑ multiple orders" tone="gold" icon={Crown} active={selectedTab === "Repeat Customers"} />
        <AdminStatCard label="Subscribed Customers" value={metrics.subscribed} delta="↑ signed-in profiles" tone="purple" icon={Mail} active={selectedTab === "Subscribed"} />
      </section>

      <section className="vh-admin-table-card">
        <div className="vh-admin-tabs" role="tablist">
          {CUSTOMER_TABLE_TABS.map((tab) => (
            <button
              key={tab}
              className={cn("vh-admin-tab", tab === selectedTab && "vh-admin-tab--active")}
              type="button"
              role="tab"
              aria-selected={tab === selectedTab}
              onClick={() => selectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="vh-admin-table-toolbar">
          <label className="vh-admin-search">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <input type="search" placeholder="Search customers..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="vh-admin-table-toolbar__filters">
            <label className="vh-admin-sort-control">
              <span>Date range:</span>
              <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRangeFilter)}>
                {DATE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </label>
            <button className="vh-admin-filter-button" type="button" onClick={() => setFilterOpen((isOpen) => !isOpen)} aria-expanded={filterOpen}>
              <Filter size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Filter</span>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        {filterOpen ? (
          <div className="vh-admin-table-filter-panel">
            <label>
              <span>Status / Tab</span>
              <select value={selectedTab} onChange={(event) => selectTab(event.target.value as CustomerTab)}>
                {CUSTOMER_TABLE_TABS.map((tab) => (
                  <option key={tab} value={tab}>{tab}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Account Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AccountStatusFilter)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers..." />
            </label>
            <button className="vh-admin-action-button" type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>
        ) : null}

        <div className="vh-admin-table-scroll">
          <table className="vh-admin-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible customers" checked={allVisibleSelected} disabled={!visibleCustomers.length} onChange={(event) => toggleAllVisible(event.target.checked)} /></th>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Location</th>
                <th>Joined On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.length ? (
                visibleCustomers.map((customer) => (
                  <tr key={customer.key}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${customer.name}`}
                        checked={selectedIds.includes(customer.key)}
                        onChange={(event) => {
                          setSelectedIds((currentIds) => (
                            event.target.checked ? [...currentIds, customer.key] : currentIds.filter((id) => id !== customer.key)
                          ));
                        }}
                      />
                    </td>
                    <td>
                      <div className="vh-admin-customer-cell">
                        <div aria-hidden="true">{customer.name.slice(0, 1).toUpperCase()}</div>
                        <span>
                          <strong>{customer.name}</strong>
                          {customer.orders > 1 ? <small className="vh-admin-vip">VIP</small> : null}
                        </span>
                      </div>
                    </td>
                    <td>{customer.email || "Not recorded"}</td>
                    <td>{customer.phone || "Not recorded"}</td>
                    <td><strong className="vh-admin-purple-text">{customer.orders}</strong></td>
                    <td>{formatPhp(customer.totalSpent)}</td>
                    <td>{customer.location}</td>
                    <td>{formatDateTime(customer.latestAt)}</td>
                    <td>
                      <AdminStatusBadge tone={customer.accountStatus === "active" ? "active" : "inactive"}>
                        {customer.accountStatus.charAt(0).toUpperCase() + customer.accountStatus.slice(1)}
                      </AdminStatusBadge>
                    </td>
                    <td>
                      <Link className="vh-admin-icon-button" href={`/admin/customers/${encodeURIComponent(customer.key)}`}>View</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="vh-admin-empty-state">
                      <strong>{customers.length ? "No matching records." : "No customers yet."}</strong>
                      <p>{customers.length ? "Adjust the search, customer type, date range, or filters to view more records." : "Customer activity will appear after orders are placed."}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="vh-admin-pagination">
          <span>Showing {showingStart} to {showingEnd} of {filteredCustomers.length} records</span>
          <div>
            <button type="button" className="vh-admin-page-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">
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
            <button type="button" className="vh-admin-page-button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Next page">
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
    </>
  );
}
