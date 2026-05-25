import "server-only";

import type { AdminAnalyticsDonutSegment, AdminAnalyticsSalesPoint } from "@/components/admin/admin-analytics-charts";
import type { CatalogProduct } from "@/lib/catalog";
import { loadAdminManualCustomers } from "@/lib/customers";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { loadAdminCatalogProducts } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

export type ReportRangeKey = "last7" | "last30" | "month" | "all";
export type ReportTabKey =
  | "overview"
  | "sales"
  | "orders"
  | "products"
  | "customers"
  | "marketing"
  | "inventory";

export type ReportRange = {
  key: ReportRangeKey;
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  label: string;
};

export type ReportDefinition = {
  id: ReportTabKey;
  name: string;
  type: string;
  dateRange: string;
  generatedOn: string;
  generatedBy: string;
  format: "CSV";
};

export type ReportTopProduct = {
  key: string;
  name: string;
  image: string | null;
  revenue: number;
  sold: number;
};

export type AdminReportData = {
  range: ReportRange;
  previousRange: ReportRange;
  loadErrors: string[];
  orders: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  profiles: Array<Record<string, any>>;
  orderItems: Array<Record<string, any>>;
  products: CatalogProduct[];
  manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>>;
  currentOrders: Array<Record<string, any>>;
  previousOrders: Array<Record<string, any>>;
  currentPaidPayments: Array<Record<string, any>>;
  previousPaidPayments: Array<Record<string, any>>;
  revenue: number;
  previousRevenue: number;
  averageOrderValue: number;
  previousAverageOrderValue: number;
  conversionRate: number;
  previousConversionRate: number;
  totalCustomers: number;
  previousCustomerCount: number;
  salesPoints: AdminAnalyticsSalesPoint[];
  salesByCategory: AdminAnalyticsDonutSegment[];
  orderStatusSegments: AdminAnalyticsDonutSegment[];
  salesByChannel: AdminAnalyticsDonutSegment[];
  topProducts: ReportTopProduct[];
  inventorySegments: AdminAnalyticsDonutSegment[];
  recentReports: ReportDefinition[];
};

export const REPORT_RANGE_OPTIONS: Array<{ value: ReportRangeKey; label: string }> = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export const REPORT_TABS: Array<{ key: ReportTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales Reports" },
  { key: "orders", label: "Order Reports" },
  { key: "products", label: "Product Reports" },
  { key: "customers", label: "Customer Reports" },
  { key: "marketing", label: "Marketing Reports" },
  { key: "inventory", label: "Inventory Reports" },
];

const ADMIN_TIME_ZONE = "Asia/Manila";
const CATEGORY_COLORS = ["#7c3aed", "#74b9f2", "#70d4ad", "#ffbc65", "#ef7dae", "#9ca3af"];
const STATUS_COLORS = ["#70d4ad", "#74b9f2", "#ffbc65", "#ef7dae", "#7c3aed", "#9ca3af"];
const CHANNEL_COLORS = ["#7c3aed", "#74b9f2", "#70d4ad", "#ffbc65", "#ef7dae"];

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function shiftDate(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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

function getDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function getDateRangeDays(startDate: Date, endDate: Date) {
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

function normalizeLookupKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function resolveRange(key: ReportRangeKey, orders: Array<Record<string, any>>, payments: Array<Record<string, any>>): ReportRange {
  const today = new Date();
  const allDates = [...orders.map((order) => order.created_at), ...payments.map((payment) => getPaymentDate(payment))]
    .filter(Boolean)
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  const start = key === "last7"
    ? shiftDate(today, -6)
    : key === "month"
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : key === "all" && allDates[0]
        ? new Date(allDates[0])
        : shiftDate(today, -29);
  const startKey = getDateKey(start);
  const endKey = getDateKey(today);

  return {
    key,
    start,
    end: today,
    startKey,
    endKey,
    label: key === "all" ? "All time" : `${formatRangeDate(getDateFromKey(startKey))} - ${formatRangeDate(getDateFromKey(endKey))}`,
  };
}

function resolvePreviousRange(currentRange: ReportRange): ReportRange {
  if (currentRange.key === "all") {
    return {
      ...currentRange,
      label: "Previous period unavailable",
    };
  }

  const currentDays = getDateRangeDays(currentRange.start, currentRange.end).length;
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

function isInRange(value: string | Date | null | undefined, range: ReportRange) {
  if (range.key === "all") {
    return Boolean(value);
  }

  const dateKey = getDateKey(value);
  return Boolean(dateKey && dateKey >= range.startKey && dateKey <= range.endKey);
}

function getPaymentDate(payment: Record<string, any>) {
  return payment.updated_at || payment.created_at;
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

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function getPaymentRevenue(payment: Record<string, any>) {
  return toNumber(payment.amount_expected_fiat);
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

function buildSalesPoints(payments: Array<Record<string, any>>, orders: Array<Record<string, any>>, currentRange: ReportRange, previousRange: ReportRange): AdminAnalyticsSalesPoint[] {
  const currentDays = currentRange.key === "all" ? getDateRangeDays(currentRange.start, currentRange.end).slice(-30) : getDateRangeDays(currentRange.start, currentRange.end);
  const previousDays = getDateRangeDays(previousRange.start, previousRange.end);
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

function buildPaidOrderIdSet(orders: Array<Record<string, any>>, currentPaidPayments: Array<Record<string, any>>, currentRange: ReportRange) {
  const paidOrderKeys = new Set<string>();

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

  return paidOrderKeys;
}

function buildTopProducts(products: CatalogProduct[], orders: Array<Record<string, any>>, orderItems: Array<Record<string, any>>, currentPaidPayments: Array<Record<string, any>>, currentRange: ReportRange) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByName = new Map(products.map((product) => [normalizeLookupKey(product.name), product]));
  const paidOrderKeys = buildPaidOrderIdSet(orders, currentPaidPayments, currentRange);
  const groups = new Map<string, ReportTopProduct>();

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

  return [...groups.values()].sort((left, right) => right.revenue - left.revenue || right.sold - left.sold).slice(0, 8);
}

function buildSalesByCategory(products: CatalogProduct[], orders: Array<Record<string, any>>, orderItems: Array<Record<string, any>>, currentPaidPayments: Array<Record<string, any>>, currentRange: ReportRange): AdminAnalyticsDonutSegment[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByName = new Map(products.map((product) => [normalizeLookupKey(product.name), product]));
  const paidOrderKeys = buildPaidOrderIdSet(orders, currentPaidPayments, currentRange);
  const groups = new Map<string, number>();

  for (const item of orderItems.filter((item) => paidOrderKeys.has(String(item.order_id)))) {
    const product = (item.product_id && productsById.get(item.product_id)) || productsByName.get(normalizeLookupKey(item.product_name));
    const category = product?.categoryLabel || "Uncategorized";
    groups.set(category, (groups.get(category) || 0) + toNumber(item.line_total));
  }

  if (!groups.size) {
    for (const order of orders.filter((order) => isPaidOrder(order) && isInRange(order.created_at, currentRange))) {
      const product = (order.product_id && productsById.get(order.product_id)) || productsByName.get(normalizeLookupKey(order.product_name));
      const category = product?.categoryLabel || "Uncategorized";
      groups.set(category, (groups.get(category) || 0) + toNumber(order.amount));
    }
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  return [...groups.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([label, value], index) => ({
    label,
    value,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    detail: `${formatAmountWithUnit(value, "PHP")} (${total ? ((value / total) * 100).toFixed(1) : "0.0"}%)`,
  }));
}

function getStatusLabel(status: string) {
  const normalized = normalizeLookupKey(status);

  if (normalized === "paid") {
    return "Completed";
  }

  if (normalized === "pending") {
    return "Pending";
  }

  if (normalized === "cancelled") {
    return "Cancelled";
  }

  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function buildOrderStatusSegments(orders: Array<Record<string, any>>, currentRange: ReportRange): AdminAnalyticsDonutSegment[] {
  const groups = new Map<string, number>();

  for (const order of orders.filter((order) => isInRange(order.created_at, currentRange))) {
    const label = getStatusLabel(order.status);
    groups.set(label, (groups.get(label) || 0) + 1);
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  return [...groups.entries()].sort((left, right) => right[1] - left[1]).map(([label, value], index) => ({
    label,
    value,
    color: STATUS_COLORS[index % STATUS_COLORS.length],
    detail: `${value} (${total ? ((value / total) * 100).toFixed(1) : "0.0"}%)`,
  }));
}

function mapChannelLabel(rawValue: string | null | undefined) {
  const value = normalizeLookupKey(rawValue);

  if (!value) {
    return null;
  }

  if (value.includes("mobile") || value.includes("app")) {
    return "Mobile";
  }

  if (value.includes("email") || value.includes("newsletter")) {
    return "Email";
  }

  if (value.includes("sms") || value.includes("text")) {
    return "SMS";
  }

  if (value.includes("push")) {
    return "Push Notification";
  }

  if (value.includes("banner")) {
    return "Website Banner";
  }

  if (value.includes("social") || value.includes("facebook") || value.includes("instagram") || value.includes("tiktok")) {
    return "Social Media";
  }

  if (value.includes("organic") || value.includes("search") || value.includes("google") || value.includes("bing")) {
    return "Organic Search";
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
  return mapChannelLabel(
    order.source ||
      order.utm_source ||
      order.medium ||
      order.utm_medium ||
      order.sales_channel ||
      order.channel ||
      order.traffic_source ||
      order.device_type ||
      order.campaign_name ||
      order.utm_campaign,
  );
}

function buildSalesByChannel(orders: Array<Record<string, any>>, currentRange: ReportRange): AdminAnalyticsDonutSegment[] {
  const groups = new Map<string, number>();

  for (const order of orders.filter((order) => isPaidOrder(order) && isInRange(order.created_at, currentRange))) {
    const channel = getOrderChannel(order);

    if (!channel) {
      continue;
    }

    groups.set(channel, (groups.get(channel) || 0) + toNumber(order.amount));
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  return [...groups.entries()].sort((left, right) => right[1] - left[1]).map(([label, value], index) => ({
    label,
    value,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    detail: `${formatAmountWithUnit(value, "PHP")} (${total ? ((value / total) * 100).toFixed(1) : "0.0"}%)`,
  }));
}

function buildInventorySegments(products: CatalogProduct[]): AdminAnalyticsDonutSegment[] {
  const groups = new Map<string, number>([
    ["In Stock", 0],
    ["Low Stock", 0],
    ["Out of Stock", 0],
  ]);

  for (const product of products) {
    const stock = getProductStock(product);
    const label = stock <= 0 ? "Out of Stock" : stock <= 2 ? "Low Stock" : "In Stock";
    groups.set(label, (groups.get(label) || 0) + 1);
  }

  const colors = ["#70d4ad", "#ffbc65", "#ef7dae"];
  const total = products.length;

  return [...groups.entries()].filter(([, value]) => value > 0).map(([label, value], index) => ({
    label,
    value,
    color: colors[index % colors.length],
    detail: `${value} (${total ? ((value / total) * 100).toFixed(1) : "0.0"}%)`,
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

function buildRecentReports(range: ReportRange): ReportDefinition[] {
  const generatedOn = formatDateTime(new Date().toISOString());

  return [
    { id: "overview", name: "Store Overview Report", type: "Overview", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "sales", name: "Sales Summary Report", type: "Sales", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "orders", name: "Order Summary Report", type: "Orders", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "products", name: "Product Performance Report", type: "Products", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "customers", name: "Customer Report", type: "Customers", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "marketing", name: "Marketing Attribution Report", type: "Marketing", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
    { id: "inventory", name: "Inventory Report", type: "Inventory", dateRange: range.label, generatedOn, generatedBy: "Current admin", format: "CSV" },
  ];
}

export function resolveReportRangeKey(value: string | string[] | undefined): ReportRangeKey {
  const key = Array.isArray(value) ? value[0] : value;

  return key === "last7" || key === "month" || key === "all" ? key : "last30";
}

export function resolveReportTabKey(value: string | string[] | undefined): ReportTabKey {
  const key = Array.isArray(value) ? value[0] : value;

  return key === "sales" ||
    key === "orders" ||
    key === "products" ||
    key === "customers" ||
    key === "marketing" ||
    key === "inventory"
    ? key
    : "overview";
}

export function formatReportMetricDelta(current: number, previous: number, range: ReportRange, fallback: string) {
  if (range.key === "all") {
    return fallback;
  }

  if (previous <= 0) {
    return current > 0 ? "New activity vs previous period" : "No previous period data";
  }

  const change = ((current - previous) / previous) * 100;
  const direction = change >= 0 ? "up" : "down";

  return `${Math.abs(change).toFixed(1)}% ${direction} vs previous period`;
}

export async function loadAdminReportData(rangeKey: ReportRangeKey): Promise<AdminReportData> {
  const admin = createSupabaseAdminClient();
  const loadErrors: string[] = [];
  const [ordersResult, paymentsResult, profilesResult, orderItemsResult] = await Promise.all([
    admin.from("orders").select("*").order("created_at", { ascending: false }),
    admin.from("payments").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("order_items").select("*").order("created_at", { ascending: false }),
  ]);
  const orders = ordersResult.data || [];
  const payments = paymentsResult.data || [];
  const profiles = profilesResult.data || [];
  const orderItems = orderItemsResult.data || [];

  [ordersResult.error?.message, paymentsResult.error?.message, profilesResult.error?.message, orderItemsResult.error?.message]
    .filter(Boolean)
    .forEach((error) => loadErrors.push(error as string));

  let products: CatalogProduct[] = [];
  let manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>> = [];

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadErrors.push(getErrorMessage(error, "Unable to load product report data."));
  }

  try {
    manualCustomers = await loadAdminManualCustomers();
  } catch {
    manualCustomers = [];
  }

  const range = resolveRange(rangeKey, orders, payments);
  const previousRange = resolvePreviousRange(range);
  const currentOrders = orders.filter((order) => isInRange(order.created_at, range));
  const previousOrders = orders.filter((order) => isInRange(order.created_at, previousRange));
  const currentPaidPayments = payments.filter((payment) => isPaidPayment(payment) && isInRange(getPaymentDate(payment), range));
  const previousPaidPayments = payments.filter((payment) => isPaidPayment(payment) && isInRange(getPaymentDate(payment), previousRange));
  const revenue = currentPaidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0);
  const previousRevenue = previousPaidPayments.reduce((total, payment) => total + getPaymentRevenue(payment), 0);
  const averageOrderValue = currentPaidPayments.length ? revenue / currentPaidPayments.length : 0;
  const previousAverageOrderValue = previousPaidPayments.length ? previousRevenue / previousPaidPayments.length : 0;
  const conversionRate = currentOrders.length ? (currentPaidPayments.length / currentOrders.length) * 100 : 0;
  const previousConversionRate = previousOrders.length ? (previousPaidPayments.length / previousOrders.length) * 100 : 0;
  const knownCustomerKeys = buildKnownCustomerKeys(orders, profiles, manualCustomers);
  const previousCustomerKeys = new Set<string>();

  for (const order of orders.filter((order) => getDateKey(order.created_at) && getDateKey(order.created_at) <= previousRange.endKey)) {
    previousCustomerKeys.add(getCustomerKeyFromOrder(order));
  }

  for (const profile of profiles.filter((profile) => getDateKey(profile.created_at) && getDateKey(profile.created_at) <= previousRange.endKey)) {
    previousCustomerKeys.add(String(profile.email || profile.id).trim().toLowerCase());
  }

  for (const customer of manualCustomers.filter((customer) => getDateKey(customer.createdAt) && getDateKey(customer.createdAt) <= previousRange.endKey)) {
    previousCustomerKeys.add(String(customer.email || customer.id).trim().toLowerCase());
  }

  previousCustomerKeys.delete("");

  return {
    range,
    previousRange,
    loadErrors,
    orders,
    payments,
    profiles,
    orderItems,
    products,
    manualCustomers,
    currentOrders,
    previousOrders,
    currentPaidPayments,
    previousPaidPayments,
    revenue,
    previousRevenue,
    averageOrderValue,
    previousAverageOrderValue,
    conversionRate,
    previousConversionRate,
    totalCustomers: knownCustomerKeys.size,
    previousCustomerCount: previousCustomerKeys.size,
    salesPoints: buildSalesPoints(payments, orders, range, previousRange),
    salesByCategory: buildSalesByCategory(products, orders, orderItems, currentPaidPayments, range),
    orderStatusSegments: buildOrderStatusSegments(orders, range),
    salesByChannel: buildSalesByChannel(orders, range),
    topProducts: buildTopProducts(products, orders, orderItems, currentPaidPayments, range),
    inventorySegments: buildInventorySegments(products),
    recentReports: buildRecentReports(range),
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function buildReportCsv(tab: ReportTabKey, report: AdminReportData) {
  if (tab === "sales") {
    return buildCsv(
      ["Payment ID", "Order ID", "Status", "Amount PHP", "Payment Method", "Created At"],
      report.currentPaidPayments.map((payment) => [
        payment.id,
        payment.order_id || "",
        payment.status,
        payment.amount_expected_fiat || "",
        payment.payment_method || "",
        payment.created_at || "",
      ]),
    );
  }

  if (tab === "orders") {
    return buildCsv(
      ["Order Number", "Customer", "Email", "Status", "Amount PHP", "Created At"],
      report.currentOrders.map((order) => [
        order.order_number || order.id,
        order.customer_name || "",
        order.email || "",
        order.status || "",
        order.amount || "",
        order.created_at || "",
      ]),
    );
  }

  if (tab === "products") {
    return buildCsv(
      ["Product", "Sold", "Revenue PHP"],
      report.topProducts.map((product) => [product.name, product.sold, product.revenue.toFixed(2)]),
    );
  }

  if (tab === "customers") {
    return buildCsv(
      ["Metric", "Value"],
      [
        ["Total Customers", report.totalCustomers],
        ["Current Period Orders", report.currentOrders.length],
        ["Paid Payments", report.currentPaidPayments.length],
        ["Average Order Value", report.averageOrderValue.toFixed(2)],
      ],
    );
  }

  if (tab === "inventory") {
    return buildCsv(
      ["Product", "Status", "Stock", "Retail Value PHP"],
      report.products.map((product) => {
        const stock = getProductStock(product);
        const status = stock <= 0 ? "Out of Stock" : stock <= 2 ? "Low Stock" : "In Stock";
        return [product.name, status, stock, ((stock * product.pricePhpCents) / 100).toFixed(2)];
      }),
    );
  }

  if (tab === "marketing") {
    return buildCsv(
      ["Channel", "Revenue PHP", "Detail"],
      report.salesByChannel.length
        ? report.salesByChannel.map((channel) => [channel.label, channel.value.toFixed(2), channel.detail])
        : [["Channel attribution", "0.00", "No campaign or source attribution found for selected orders"]],
    );
  }

  return buildCsv(
    ["Metric", "Value"],
    [
      ["Date Range", report.range.label],
      ["Total Revenue", report.revenue.toFixed(2)],
      ["Total Orders", report.currentOrders.length],
      ["Total Customers", report.totalCustomers],
      ["Average Order Value", report.averageOrderValue.toFixed(2)],
      ["Conversion Rate", `${report.conversionRate.toFixed(2)}%`],
    ],
  );
}

export function getReportFileName(tab: ReportTabKey, range: ReportRange) {
  const label = REPORT_TABS.find((item) => item.key === tab)?.label || "Report";
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safeRange = range.key === "all" ? "all-time" : `${range.startKey}-to-${range.endKey}`;

  return `vione-hernal-${safeLabel}-${safeRange}.csv`;
}

export { formatCurrencyShort };
