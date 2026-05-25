"use client";

import { useMemo, useState } from "react";
import { Package, ShoppingBag, ShoppingCart, TrendingUp, Users } from "lucide-react";

import { AdminStatCard } from "@/components/admin/admin-ui";

type DashboardRangeKey = "today" | "last7" | "last30" | "month" | "all";

type DashboardOrder = {
  id: string;
  status: string | null;
  email: string | null;
  customer_name: string | null;
  created_at: string | null;
};

type DashboardPayment = {
  status: string | null;
  amount_expected_fiat: string | number | null;
  created_at: string | null;
  updated_at: string | null;
};

type DashboardProfile = {
  id: string;
  created_at: string | null;
};

type Props = {
  orders: DashboardOrder[];
  payments: DashboardPayment[];
  profiles: DashboardProfile[];
};

const ADMIN_TIME_ZONE = "Asia/Manila";

const RANGE_OPTIONS: Array<{ key: DashboardRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

function matchesRange(value: string | null | undefined, range: DashboardRangeKey) {
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

function getCustomerKey(order: DashboardOrder) {
  return String(order.email || order.customer_name || order.id).toLowerCase();
}

export function AdminDashboardSummary({ orders, payments, profiles }: Props) {
  const [selectedRange, setSelectedRange] = useState<DashboardRangeKey>("all");
  const selectedLabel = RANGE_OPTIONS.find((option) => option.key === selectedRange)?.label || "All time";
  const metrics = useMemo(() => {
    const filteredOrders = orders.filter((order) => matchesRange(order.created_at, selectedRange));
    const filteredPayments = payments.filter((payment) => matchesRange(payment.updated_at || payment.created_at, selectedRange));
    const filteredProfiles = profiles.filter((profile) => matchesRange(profile.created_at, selectedRange));
    const paidPayments = filteredPayments.filter((payment) => payment.status === "paid");
    const confirmedRevenue = paidPayments.reduce((total, payment) => total + toNumber(payment.amount_expected_fiat), 0);
    const totalOrders = filteredOrders.length;
    const paidOrders = filteredOrders.filter((order) => order.status === "paid");
    const averageOrderValue = paidOrders.length ? confirmedRevenue / paidOrders.length : 0;
    const conversionRate = totalOrders ? (paidOrders.length / totalOrders) * 100 : 0;
    const uniqueOrderCustomers = new Set(filteredOrders.map(getCustomerKey)).size;
    const customerCount = uniqueOrderCustomers || filteredProfiles.length;

    return {
      confirmedRevenue,
      totalOrders,
      customerCount,
      averageOrderValue,
      conversionRate,
    };
  }, [orders, payments, profiles, selectedRange]);

  return (
    <section className="vh-admin-dashboard-summary" aria-label="Store overview">
      <div className="vh-admin-dashboard-summary__header">
        <div>
          <h2>Dashboard Summary</h2>
          <p>Top cards filtered by {selectedLabel.toLowerCase()}.</p>
        </div>
        <select
          value={selectedRange}
          aria-label="Dashboard summary date range"
          onChange={(event) => setSelectedRange(event.target.value as DashboardRangeKey)}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="vh-admin-stats-grid vh-admin-stats-grid--five">
        <AdminStatCard href="/admin/payments" label="Total Revenue" value={formatPhp(metrics.confirmedRevenue)} delta="↑ confirmed payments" icon={ShoppingBag} />
        <AdminStatCard href="/admin/orders" label="Orders" value={metrics.totalOrders} delta="↑ live order records" tone="purple" icon={ShoppingCart} />
        <AdminStatCard href="/admin/customers" label="Customers" value={metrics.customerCount} delta="↑ known profiles" tone="blue" icon={Users} />
        <AdminStatCard href="/admin/analytics" label="AOV" value={formatPhp(metrics.averageOrderValue)} delta="↑ paid orders only" tone="gold" icon={Package} />
        <AdminStatCard href="/admin/analytics" label="Conversion Rate" value={`${metrics.conversionRate.toFixed(2)}%`} delta="↑ paid / total orders" tone="rose" icon={TrendingUp} />
      </div>
    </section>
  );
}
