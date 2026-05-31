import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { AdminAnalyticsDateControls } from "@/components/admin/admin-analytics-date-controls";
import {
  AdminAnalyticsDonutChart,
  AdminAnalyticsSalesChart,
  AdminAnalyticsTrafficChart,
  type AdminAnalyticsDonutSegment,
  type AdminAnalyticsSalesPoint,
  type AdminAnalyticsTrafficPoint,
} from "@/components/admin/admin-analytics-charts";
import { AdminPageHeader, EmptyAdminState } from "@/components/admin/admin-ui";
import { loadGa4TrafficOverview } from "@/lib/analytics/ga4";
import { requireAdminArea } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { loadAdminManualCustomers } from "@/lib/customers";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { loadAdminCatalogProducts } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

type Props = {
  searchParams?: Promise<{
    range?: string | string[];
    compare?: string | string[];
  }>;
};

type AnalyticsRangeKey = "today" | "last7" | "last30" | "month" | "all";
type AnalyticsCompareKey = "previous" | "none";

type DateRange = {
  key: AnalyticsRangeKey;
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  label: string;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  delta: string;
  tone?: "purple" | "green" | "blue" | "gold" | "rose";
  icon: typeof ShoppingBag;
  href: string;
  trend?: "positive" | "negative" | "muted";
};

type TopProduct = {
  key: string;
  name: string;
  image: string | null;
  revenue: number;
  sold: number;
};

type ActivityItem = {
  key: string;
  title: string;
  copy: string;
  href: string;
  date: string;
  icon: typeof ShoppingCart;
  tone: "purple" | "green" | "blue" | "gold" | "rose";
};

const ADMIN_TIME_ZONE = "Asia/Manila";
const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];
const COMPARE_OPTIONS = [
  { value: "previous", label: "Previous period" },
  { value: "none", label: "No comparison" },
];
const CHANNEL_COLORS = ["#7c3aed", "#74b9f2", "#70d4ad", "#ffbc65", "#ef7dae"];

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveRangeKey(value: string | string[] | undefined): AnalyticsRangeKey {
  const normalized = getFirstParam(value);

  return normalized === "today" || normalized === "last7" || normalized === "month" || normalized === "all"
    ? normalized
    : "last30";
}

function resolveCompareKey(value: string | string[] | undefined): AnalyticsCompareKey {
  return getFirstParam(value) === "none" ? "none" : "previous";
}

function getDateKey(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;
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

function shiftDate(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function getDateRange(startDate: Date, endDate: Date) {
  const days: string[] = [];
  let cursor = new Date(startDate);
  const endKey = getDateKey(endDate);

  while (getDateKey(cursor) <= endKey) {
    days.push(getDateKey(cursor));
    cursor = shiftDate(cursor, 1);
  }

  return days;
}

function formatRangeDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(getDateFromKey(dateKey));
}

function getEarliestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0] || null;
}

function resolveCurrentRange(key: AnalyticsRangeKey, seedDates: Array<string | null | undefined> = []): DateRange {
  const today = new Date();
  const end = today;
  const allTimeStart = getEarliestDate(seedDates);
  const start = key === "today"
    ? today
    : key === "last7"
      ? shiftDate(today, -6)
      : key === "month"
        ? new Date(today.getFullYear(), today.getMonth(), 1)
        : key === "all" && allTimeStart
          ? allTimeStart
          : shiftDate(today, -29);
  const startKey = getDateKey(start);
  const endKey = getDateKey(end);

  return {
    key,
    start,
    end,
    startKey,
    endKey,
    label: key === "today"
      ? "Today"
      : key === "all"
        ? "All time"
        : `${formatRangeDate(getDateFromKey(startKey))} - ${formatRangeDate(getDateFromKey(endKey))}`,
  };
}

function resolvePreviousRange(currentRange: DateRange): DateRange {
  if (currentRange.key === "all") {
    return {
      ...currentRange,
      label: "Previous period unavailable",
    };
  }

  const currentDays = getDateRange(currentRange.start, currentRange.end).length;
  const previousEnd = shiftDate(currentRange.start, -1);
  const previousStart = shiftDate(previousEnd, -(currentDays - 1));
  const startKey = getDateKey(previousStart);
  const endKey = getDateKey(previousEnd);

  return {
    key: currentRange.key,
    start: previousStart,
    end: previousEnd,
    startKey,
    endKey,
    label: `${formatRangeDate(getDateFromKey(startKey))} - ${formatRangeDate(getDateFromKey(endKey))}`,
  };
}

function isInRange(value: string | Date | null | undefined, range: DateRange) {
  if (range.key === "all") {
    return Boolean(value);
  }

  const dateKey = getDateKey(value);

  return Boolean(dateKey && dateKey >= range.startKey && dateKey <= range.endKey);
}

function getPercentChange(current: number, previous: number) {
  if (previous <= 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function formatMetricDelta(current: number, previous: number, compareEnabled: boolean, fallback: string) {
  if (!compareEnabled) {
    return fallback;
  }

  const change = getPercentChange(current, previous);

  if (change === null) {
    return previous > 0 || current > 0 ? "New activity vs previous period" : "No previous period data";
  }

  const direction = change >= 0 ? "up" : "down";

  return `${Math.abs(change).toFixed(1)}% ${direction} vs previous period`;
}

function resolveTrend(current: number, previous: number, compareEnabled: boolean) {
  if (!compareEnabled || previous <= 0) {
    return "muted" as const;
  }

  return current >= previous ? "positive" as const : "negative" as const;
}

function formatAnalyticsNumber(value: number | null | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "--";
}

function formatCurrencyShort(value: number) {
  if (value >= 1000000) {
    return `P${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `P${Math.round(value / 1000)}K`;
  }

  return `P${Math.round(value)}`;
}

function getPaymentDate(payment: Record<string, any>) {
  return payment.updated_at || payment.created_at;
}

function getPaymentRevenue(payment: Record<string, any>) {
  return toNumber(payment.amount_expected_fiat);
}

function isPaidPayment(payment: Record<string, any>) {
  return payment.status === "paid";
}

function isPaidOrder(order: Record<string, any>) {
  return order.status === "paid" || order.status === "completed" || order.status === "delivered";
}

function getCustomerKeyFromOrder(order: Record<string, any>) {
  return String(order.email || order.user_id || order.customer_name || order.id).trim().toLowerCase();
}

function getCustomerName(order: Record<string, any>) {
  return order.customer_name || order.email || "Guest customer";
}

function normalizeLookupKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function mapChannelLabel(rawValue: string | null | undefined) {
  const value = normalizeLookupKey(rawValue);

  if (!value) {
    return null;
  }

  if (value.includes("mobile") || value.includes("app")) {
    return "Mobile";
  }

  if (value.includes("social") || value.includes("facebook") || value.includes("instagram") || value.includes("tiktok")) {
    return "Social Media";
  }

  if (value.includes("direct")) {
    return "Direct";
  }

  if (value.includes("online") || value.includes("web") || value.includes("store")) {
    return "Online Store";
  }

  return "Other";
}

function getOrderChannel(order: Record<string, any>) {
  return mapChannelLabel(order.sales_channel || order.channel || order.source || order.traffic_source || order.utm_source || order.device_type);
}

function mapTrafficSourceLabel(rawValue: string) {
  const value = normalizeLookupKey(rawValue);

  if (value.includes("organic search")) {
    return "Organic Search";
  }

  if (value.includes("social")) {
    return "Social Media";
  }

  if (value.includes("referral")) {
    return "Referral";
  }

  if (value.includes("direct")) {
    return "Direct";
  }

  return rawValue && rawValue !== "(not set)" ? rawValue : "Other";
}

function buildSalesPoints(payments: Array<Record<string, any>>, orders: Array<Record<string, any>>, currentRange: DateRange, previousRange: DateRange): AdminAnalyticsSalesPoint[] {
  const currentDays = currentRange.key === "all"
    ? getDateRange(currentRange.start, currentRange.end).slice(-30)
    : getDateRange(currentRange.start, currentRange.end);
  const previousDays = getDateRange(previousRange.start, previousRange.end);
  const revenueByDate = new Map<string, number>();
  const ordersByDate = new Map<string, number>();

  for (const payment of payments.filter(isPaidPayment)) {
    const dateKey = getDateKey(getPaymentDate(payment));
    revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + getPaymentRevenue(payment));
  }

  for (const order of orders) {
    const dateKey = getDateKey(order.created_at);
    ordersByDate.set(dateKey, (ordersByDate.get(dateKey) || 0) + 1);
  }

  return currentDays.map((dateKey, index) => {
    const previousDateKey = previousDays[index] || "";

    return {
      key: dateKey,
      label: formatShortDate(dateKey),
      currentRevenue: revenueByDate.get(dateKey) || 0,
      previousRevenue: currentRange.key === "all" ? 0 : revenueByDate.get(previousDateKey) || 0,
      currentOrders: ordersByDate.get(dateKey) || 0,
      previousOrders: currentRange.key === "all" ? 0 : ordersByDate.get(previousDateKey) || 0,
    };
  });
}

function buildTopProducts(
  products: CatalogProduct[],
  orders: Array<Record<string, any>>,
  orderItems: Array<Record<string, any>>,
  currentPaidPayments: Array<Record<string, any>>,
  currentRange: DateRange,
) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByName = new Map(products.map((product) => [normalizeLookupKey(product.name), product]));
  const paidOrderKeys = new Set<string>();
  const groups = new Map<string, TopProduct>();

  for (const payment of currentPaidPayments) {
    if (payment.order_id) {
      paidOrderKeys.add(String(payment.order_id));
    }
  }

  for (const order of orders.filter((order) => isPaidOrder(order) && isInRange(order.created_at, currentRange))) {
    paidOrderKeys.add(String(order.id));

    if (order.order_number) {
      paidOrderKeys.add(String(order.order_number));
    }
  }

  for (const item of orderItems.filter((item) => paidOrderKeys.has(String(item.order_id)))) {
    const name = item.product_name || "Untitled product";
    const product = (item.product_id && productsById.get(item.product_id)) || productsByName.get(normalizeLookupKey(name));
    const key = item.product_id || normalizeLookupKey(name);
    const current = groups.get(key) || {
      key,
      name,
      image: product?.image || null,
      revenue: 0,
      sold: 0,
    };

    current.revenue += toNumber(item.line_total);
    current.sold += toNumber(item.quantity);
    groups.set(key, current);
  }

  if (!groups.size) {
    for (const order of orders.filter((order) => isPaidOrder(order) && isInRange(order.created_at, currentRange))) {
      const name = order.product_name || "Order item";
      const product = (order.product_id && productsById.get(order.product_id)) || productsByName.get(normalizeLookupKey(name));
      const key = order.product_id || normalizeLookupKey(name);
      const current = groups.get(key) || {
        key,
        name,
        image: product?.image || null,
        revenue: 0,
        sold: 0,
      };

      current.revenue += toNumber(order.amount);
      current.sold += toNumber(order.quantity || 1);
      groups.set(key, current);
    }
  }

  return [...groups.values()]
    .sort((left, right) => right.revenue - left.revenue || right.sold - left.sold)
    .slice(0, 5);
}

function buildSalesByChannel(orders: Array<Record<string, any>>, currentRange: DateRange): AdminAnalyticsDonutSegment[] {
  const groups = new Map<string, number>();

  for (const order of orders.filter((order) => isPaidOrder(order) && isInRange(order.created_at, currentRange))) {
    const channel = getOrderChannel(order);

    if (!channel) {
      continue;
    }

    groups.set(channel, (groups.get(channel) || 0) + toNumber(order.amount));
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  return [...groups.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, value], index) => ({
      label,
      value,
      color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
      detail: `${formatAmountWithUnit(value, "PHP")} (${total ? ((value / total) * 100).toFixed(1) : "0.0"}%)`,
    }));
}

function buildTrafficBreakdown(sources: Array<{ channel: string; activeUsers: number; sessions: number }>) {
  const groups = new Map<string, { activeUsers: number; sessions: number }>();

  for (const source of sources) {
    const label = mapTrafficSourceLabel(source.channel);
    const current = groups.get(label) || { activeUsers: 0, sessions: 0 };
    current.activeUsers += source.activeUsers;
    current.sessions += source.sessions;
    groups.set(label, current);
  }

  return [...groups.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.sessions - left.sessions)
    .slice(0, 5);
}

function buildTrafficPoints(days: string[], daily: Array<{ date: string; activeUsers: number }>): AdminAnalyticsTrafficPoint[] {
  const usersByDate = new Map(daily.map((point) => [point.date, point.activeUsers]));

  return days.map((dateKey) => ({
    key: dateKey,
    label: formatShortDate(dateKey),
    value: usersByDate.get(dateKey) || 0,
  }));
}

function buildKnownCustomerKeys(orders: Array<Record<string, any>>, profiles: Array<Record<string, any>>, manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>>) {
  const keys = new Set<string>();

  for (const order of orders) {
    keys.add(getCustomerKeyFromOrder(order));
  }

  for (const profile of profiles) {
    keys.add(String(profile.email || profile.id).trim().toLowerCase());
  }

  for (const customer of manualCustomers) {
    keys.add(String(customer.email || customer.id).trim().toLowerCase());
  }

  keys.delete("");

  return keys;
}

function buildRecentActivity(
  orders: Array<Record<string, any>>,
  profiles: Array<Record<string, any>>,
  manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>>,
  products: CatalogProduct[],
  blogPosts: Array<Record<string, any>>,
): ActivityItem[] {
  const orderActivities = orders.slice(0, 3).map((order) => ({
    key: `order-${order.id}`,
    title: `New order ${order.order_number ? `#${order.order_number}` : ""}`.trim(),
    copy: `${formatAmountWithUnit(toNumber(order.amount), order.currency || "PHP")} by ${getCustomerName(order)}`,
    href: "/admin/orders",
    date: order.created_at,
    icon: ShoppingCart,
    tone: "blue" as const,
  }));
  const manualCustomerActivities = manualCustomers.slice(0, 2).map((customer) => ({
    key: `manual-customer-${customer.id}`,
    title: "New customer registered",
    copy: customer.fullName || customer.email,
    href: "/admin/customers",
    date: customer.createdAt,
    icon: UserPlus,
    tone: "green" as const,
  }));
  const profileActivities = profiles.slice(0, 2).map((profile) => ({
    key: `profile-${profile.id}`,
    title: "New customer profile",
    copy: profile.email || profile.id,
    href: "/admin/customers",
    date: profile.created_at,
    icon: Users,
    tone: "green" as const,
  }));
  const productActivities = products.slice(0, 2).map((product) => ({
    key: `product-${product.id}`,
    title: "Product updated",
    copy: product.name,
    href: "/admin/products",
    date: product.updatedAt || product.publishedAt || "",
    icon: Package,
    tone: "gold" as const,
  }));
  const blogActivities = blogPosts.slice(0, 2).map((post) => ({
    key: `blog-${post.id}`,
    title: post.status === "published" ? "Blog post published" : "Blog post updated",
    copy: post.title,
    href: "/admin/blog",
    date: post.publish_at || post.updated_at || post.created_at,
    icon: FileText,
    tone: "purple" as const,
  }));

  return [...orderActivities, ...manualCustomerActivities, ...profileActivities, ...productActivities, ...blogActivities]
    .filter((activity) => activity.date)
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 4);
}

function AnalyticsMetricCard({ label, value, delta, tone = "purple", icon: Icon, href, trend = "muted" }: MetricCardProps) {
  return (
    <Link href={href} className="vh-admin-analytics-metric-card-link">
      <article className={`vh-admin-analytics-metric-card vh-admin-analytics-metric-card--${tone}`}>
        <span className="vh-admin-analytics-metric-card__icon">
          <Icon size={23} strokeWidth={1.85} aria-hidden="true" />
        </span>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
          <p data-trend={trend}>{delta}</p>
        </div>
      </article>
    </Link>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  await requireAdminArea("reports");
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRange = resolveRangeKey(resolvedSearchParams.range);
  const selectedCompare = resolveCompareKey(resolvedSearchParams.compare);
  const admin = createSupabaseAdminClient();

  let orders: Array<Record<string, any>> = [];
  let payments: Array<Record<string, any>> = [];
  let profiles: Array<Record<string, any>> = [];
  let orderItems: Array<Record<string, any>> = [];
  let products: CatalogProduct[] = [];
  let manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>> = [];
  let blogPosts: Array<Record<string, any>> = [];
  const loadErrors: string[] = [];

  const [
    ordersResult,
    paymentsResult,
    profilesResult,
    orderItemsResult,
    blogPostsResult,
  ] = await Promise.all([
    admin.from("orders").select("*").order("created_at", { ascending: false }),
    admin.from("payments").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("order_items").select("*").order("created_at", { ascending: false }),
    admin.from("blog_posts").select("*").order("updated_at", { ascending: false }).limit(5),
  ]);

  orders = ordersResult.data || [];
  payments = paymentsResult.data || [];
  profiles = profilesResult.data || [];
  orderItems = orderItemsResult.data || [];
  blogPosts = blogPostsResult.data || [];

  [ordersResult.error?.message, paymentsResult.error?.message, profilesResult.error?.message]
    .filter(Boolean)
    .forEach((error) => loadErrors.push(error as string));

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadErrors.push(getErrorMessage(error, "Unable to load product analytics right now."));
  }

  try {
    manualCustomers = await loadAdminManualCustomers();
  } catch (error) {
    console.warn("[Analytics] Customer table unavailable.", { error: getErrorMessage(error, "Customer records unavailable.") });
  }

  const currentRange = resolveCurrentRange(selectedRange, [
    ...orders.map((order) => order.created_at),
    ...payments.map((payment) => getPaymentDate(payment)),
    ...profiles.map((profile) => profile.created_at),
    ...manualCustomers.map((customer) => customer.createdAt),
    ...products.map((product) => product.createdAt || product.publishedAt || product.updatedAt),
    ...blogPosts.map((post) => post.created_at || post.updated_at || post.publish_at),
  ]);
  const previousRange = resolvePreviousRange(currentRange);
  const compareEnabled = selectedCompare === "previous" && currentRange.key !== "all";
  const currentDays = currentRange.key === "all"
    ? getDateRange(currentRange.start, currentRange.end).slice(-30)
    : getDateRange(currentRange.start, currentRange.end);
  const [currentTraffic, previousTraffic] = await Promise.all([
    loadGa4TrafficOverview({ startDate: currentRange.startKey, endDate: currentRange.endKey }),
    compareEnabled
      ? loadGa4TrafficOverview({ startDate: previousRange.startKey, endDate: previousRange.endKey })
      : Promise.resolve(null),
  ]);

  const paidPayments = payments.filter(isPaidPayment);
  const currentPayments = payments.filter((payment) => isInRange(getPaymentDate(payment), currentRange));
  const previousPayments = payments.filter((payment) => isInRange(getPaymentDate(payment), previousRange));
  const currentPaidPayments = currentPayments.filter(isPaidPayment);
  const previousPaidPayments = previousPayments.filter(isPaidPayment);
  const currentOrders = orders.filter((order) => isInRange(order.created_at, currentRange));
  const previousOrders = orders.filter((order) => isInRange(order.created_at, previousRange));
  const currentRevenue = currentPaidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0);
  const previousRevenue = previousPaidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0);
  const currentAov = currentPaidPayments.length ? currentRevenue / currentPaidPayments.length : 0;
  const previousAov = previousPaidPayments.length
    ? previousPaidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0) / previousPaidPayments.length
    : 0;
  const conversionDenominator = currentTraffic.connected && (currentTraffic.sessions || currentTraffic.activeUsers)
    ? currentTraffic.sessions || currentTraffic.activeUsers || 0
    : currentOrders.length;
  const previousConversionDenominator = previousTraffic?.connected && (previousTraffic.sessions || previousTraffic.activeUsers)
    ? previousTraffic.sessions || previousTraffic.activeUsers || 0
    : previousOrders.length;
  const currentConversionRate = conversionDenominator ? (currentPaidPayments.length / conversionDenominator) * 100 : 0;
  const previousConversionRate = previousConversionDenominator ? (previousPaidPayments.length / previousConversionDenominator) * 100 : 0;
  const knownCustomerKeys = buildKnownCustomerKeys(orders, profiles, manualCustomers);
  const firstOrderByCustomer = new Map<string, string>();
  const ordersByCustomer = new Map<string, number>();

  for (const order of orders) {
    const key = getCustomerKeyFromOrder(order);
    const currentFirst = firstOrderByCustomer.get(key);
    ordersByCustomer.set(key, (ordersByCustomer.get(key) || 0) + 1);

    if (!currentFirst || Date.parse(order.created_at) < Date.parse(currentFirst)) {
      firstOrderByCustomer.set(key, order.created_at);
    }
  }

  const newCustomerKeys = new Set<string>();
  const previousNewCustomerKeys = new Set<string>();

  for (const [key, firstDate] of firstOrderByCustomer) {
    if (isInRange(firstDate, currentRange)) {
      newCustomerKeys.add(key);
    }

    if (isInRange(firstDate, previousRange)) {
      previousNewCustomerKeys.add(key);
    }
  }

  for (const profile of profiles) {
    const key = String(profile.email || profile.id).trim().toLowerCase();

    if (isInRange(profile.created_at, currentRange)) {
      newCustomerKeys.add(key);
    }

    if (isInRange(profile.created_at, previousRange)) {
      previousNewCustomerKeys.add(key);
    }
  }

  for (const customer of manualCustomers) {
    const key = String(customer.email || customer.id).trim().toLowerCase();

    if (isInRange(customer.createdAt, currentRange)) {
      newCustomerKeys.add(key);
    }

    if (isInRange(customer.createdAt, previousRange)) {
      previousNewCustomerKeys.add(key);
    }
  }

  const returningCustomerCount = [...ordersByCustomer.values()].filter((orderCount) => orderCount > 1).length;
  const previousReturningCustomerCount = orders
    .filter((order) => isInRange(order.created_at, previousRange))
    .reduce<Map<string, number>>((customers, order) => {
      const key = getCustomerKeyFromOrder(order);
      customers.set(key, (customers.get(key) || 0) + 1);
      return customers;
    }, new Map());
  const previousReturningCount = [...previousReturningCustomerCount.values()].filter((orderCount) => orderCount > 1).length;
  const lifetimeRevenue = paidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0);
  const customerLifetimeValue = knownCustomerKeys.size ? lifetimeRevenue / knownCustomerKeys.size : 0;
  const salesPoints = buildSalesPoints(payments, orders, currentRange, previousRange);
  const salesByChannel = buildSalesByChannel(orders, currentRange);
  const topProducts = buildTopProducts(products, orders, orderItems, currentPaidPayments, currentRange);
  const trafficBreakdown = currentTraffic.connected ? buildTrafficBreakdown(currentTraffic.sourceBreakdown) : [];
  const trafficPoints = currentTraffic.connected ? buildTrafficPoints(currentDays, currentTraffic.daily) : [];
  const recentActivity = buildRecentActivity(orders, profiles, manualCustomers, products, blogPosts);
  const channelTotal = salesByChannel.reduce((total, segment) => total + segment.value, 0);
  const trafficTotal = trafficBreakdown.reduce((total, source) => total + source.sessions, 0);
  const totalCustomerCount = knownCustomerKeys.size;
  const currentVisitorCount = currentTraffic.activeUsers;
  const previousVisitorCount = previousTraffic?.activeUsers || 0;

  return (
    <div className="vh-admin-page vh-admin-analytics-page">
      <AdminPageHeader title="Analytics" subtitle="Track your store performance and grow your business.">
        <Suspense fallback={null}>
          <AdminAnalyticsDateControls
            rangeOptions={RANGE_OPTIONS}
            compareOptions={COMPARE_OPTIONS}
            selectedRange={selectedRange}
            selectedCompare={selectedCompare}
          />
        </Suspense>
      </AdminPageHeader>

      {loadErrors.length ? (
        <div className="vh-admin-alert">
          {loadErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <section className="vh-admin-analytics-metrics-grid" aria-label="Analytics metrics">
        <AnalyticsMetricCard
          href="/admin/payments"
          label="Total Revenue"
          value={formatAmountWithUnit(currentRevenue, "PHP")}
          delta={formatMetricDelta(currentRevenue, previousRevenue, compareEnabled, "Confirmed payments")}
          trend={resolveTrend(currentRevenue, previousRevenue, compareEnabled)}
          icon={ShoppingBag}
        />
        <AnalyticsMetricCard
          href="/admin/orders"
          label="Orders"
          value={currentOrders.length}
          delta={formatMetricDelta(currentOrders.length, previousOrders.length, compareEnabled, "Total order records")}
          trend={resolveTrend(currentOrders.length, previousOrders.length, compareEnabled)}
          tone="blue"
          icon={ShoppingCart}
        />
        <AnalyticsMetricCard
          href="/admin/analytics"
          label="Visitors"
          value={formatAnalyticsNumber(currentVisitorCount)}
          delta={currentTraffic.connected
            ? formatMetricDelta(currentVisitorCount || 0, previousVisitorCount, compareEnabled, "GA4 active users")
            : "Traffic analytics not connected"}
          trend={currentTraffic.connected ? resolveTrend(currentVisitorCount || 0, previousVisitorCount, compareEnabled) : "muted"}
          tone="green"
          icon={Users}
        />
        <AnalyticsMetricCard
          href="/admin/analytics"
          label="Conversion Rate"
          value={`${currentConversionRate.toFixed(2)}%`}
          delta={currentTraffic.connected ? "Paid orders / GA4 sessions" : "Paid / total orders fallback"}
          trend={resolveTrend(currentConversionRate, previousConversionRate, compareEnabled)}
          tone="gold"
          icon={TrendingUp}
        />
        <AnalyticsMetricCard
          href="/admin/reports"
          label="Average Order Value"
          value={formatAmountWithUnit(currentAov, "PHP")}
          delta={formatMetricDelta(currentAov, previousAov, compareEnabled, `${currentPaidPayments.length} paid payments`)}
          trend={resolveTrend(currentAov, previousAov, compareEnabled)}
          tone="rose"
          icon={BarChart3}
        />
      </section>

      <div className="vh-admin-analytics-layout">
        <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-panel--sales">
          <AdminAnalyticsSalesChart
            points={salesPoints}
            currentLabel={currentRange.label}
            previousLabel={compareEnabled ? previousRange.label : null}
          />
        </section>

        <section className="vh-admin-panel vh-admin-analytics-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Sales by Channel</h2>
              <p>Revenue grouped by saved order attribution.</p>
            </div>
            <span className="vh-admin-analytics-pill">{RANGE_OPTIONS.find((option) => option.value === selectedRange)?.label}</span>
          </div>
          {salesByChannel.length ? (
            <div className="vh-admin-analytics-channel-grid">
              <AdminAnalyticsDonutChart segments={salesByChannel} totalLabel={formatCurrencyShort(channelTotal)} />
              <div className="vh-admin-analytics-breakdown-list">
                {salesByChannel.map((segment) => (
                  <div key={segment.label}>
                    <span style={{ backgroundColor: segment.color }} aria-hidden="true" />
                    <strong>{segment.label}</strong>
                    <small>{segment.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyAdminState title="Channel attribution is not connected." copy="Sales channels will appear after orders include source or campaign attribution." />
          )}
        </section>

        <section className="vh-admin-panel vh-admin-analytics-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Top Products</h2>
              <p>Best sellers from confirmed orders in this period.</p>
            </div>
            <Link href="/admin/products">View all products <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {topProducts.length ? (
            <div className="vh-admin-analytics-product-list">
              <div className="vh-admin-analytics-product-header" aria-hidden="true">
                <span>Product</span>
                <span>Revenue</span>
                <span>Sold</span>
              </div>
              {topProducts.map((product) => (
                <Link key={product.key} href="/admin/products" className="vh-admin-analytics-product-row">
                  {product.image ? (
                    <img src={product.image} alt={product.name} />
                  ) : (
                    <span aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                  )}
                  <strong>{product.name}</strong>
                  <small>{formatAmountWithUnit(product.revenue, "PHP")}</small>
                  <b>{formatAnalyticsNumber(product.sold)}</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyAdminState title="No product sales for this range." copy="Products will appear after paid orders are recorded in the selected period." />
          )}
        </section>

        <section className="vh-admin-panel vh-admin-analytics-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Traffic Overview</h2>
              <p>Visitors and source mix from GA4.</p>
            </div>
            <span className="vh-admin-analytics-pill">{currentTraffic.connected ? "GA4 connected" : "GA4 needed"}</span>
          </div>
          {currentTraffic.connected ? (
            <>
              <div className="vh-admin-analytics-traffic-total">
                <strong>{formatAnalyticsNumber(currentTraffic.activeUsers)}</strong>
                <span>visitors</span>
              </div>
              <AdminAnalyticsTrafficChart points={trafficPoints} />
              <div className="vh-admin-analytics-source-list">
                {trafficBreakdown.length ? trafficBreakdown.map((source) => (
                  <div key={source.label}>
                    <span>{source.label}</span>
                    <strong>{formatAnalyticsNumber(source.sessions)} ({trafficTotal ? ((source.sessions / trafficTotal) * 100).toFixed(1) : "0.0"}%)</strong>
                  </div>
                )) : (
                  <p className="vh-admin-analytics-muted">No GA4 traffic source rows returned for this range.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyAdminState title="Traffic analytics not connected." copy="Add GA4 property access for visitors, source breakdowns, and traffic charts." />
          )}
        </section>

        <section className="vh-admin-panel vh-admin-analytics-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Customer Overview</h2>
              <p>Customer health from profiles, manual records, and orders.</p>
            </div>
            <Link href="/admin/customers">View customers <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className="vh-admin-analytics-customer-list">
            <div>
              <span><Users size={18} aria-hidden="true" /></span>
              <strong>Total Customers</strong>
              <b>{formatAnalyticsNumber(totalCustomerCount)}</b>
            </div>
            <div>
              <span><UserPlus size={18} aria-hidden="true" /></span>
              <strong>New Customers</strong>
              <b>{formatAnalyticsNumber(newCustomerKeys.size)}</b>
            </div>
            <div>
              <span><RefreshCw size={18} aria-hidden="true" /></span>
              <strong>Returning Customers</strong>
              <b>{formatAnalyticsNumber(returningCustomerCount)}</b>
            </div>
            <div>
              <span><ShoppingBag size={18} aria-hidden="true" /></span>
              <strong>Customer Lifetime Value</strong>
              <b>{totalCustomerCount ? formatAmountWithUnit(customerLifetimeValue, "PHP") : "--"}</b>
            </div>
          </div>
          {compareEnabled ? (
            <p className="vh-admin-analytics-muted">
              New customers {formatMetricDelta(newCustomerKeys.size, previousNewCustomerKeys.size, true, "current period")}; returning customers {formatMetricDelta(returningCustomerCount, previousReturningCount, true, "current period").toLowerCase()}.
            </p>
          ) : null}
        </section>
      </div>

      <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-analytics-activity-panel">
        <div className="vh-admin-panel__header">
          <div>
            <h2>Recent Activity</h2>
            <p>Newest orders, customers, product updates, and editorial changes.</p>
          </div>
          <Link href="/admin/orders">View all activity <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        {recentActivity.length ? (
          <div className="vh-admin-analytics-activity-list">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;

              return (
                <Link key={activity.key} href={activity.href} className={`vh-admin-analytics-activity-item vh-admin-analytics-activity-item--${activity.tone}`}>
                  <span><Icon size={19} strokeWidth={1.9} aria-hidden="true" /></span>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.copy}</p>
                    <small>{formatDateTime(activity.date)}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyAdminState title="No recent activity yet." copy="Orders, customers, products, and posts will appear here as records are created." />
        )}
      </section>
    </div>
  );
}
