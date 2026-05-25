import Link from "next/link";

import { AdminDashboardSummary } from "@/components/admin/admin-dashboard-summary";
import { AdminNotificationsMenu } from "@/components/admin/admin-notifications-menu";
import { AdminSalesOverview, type AdminSalesDataset } from "@/components/admin/admin-sales-overview";
import {
  AdminPageHeader,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/admin-ui";
import { AdminLiveRefresh } from "@/components/admin/admin-live-refresh";
import { loadAdminNotificationCenterRows } from "@/lib/admin/notifications";
import { requireManagementUser } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { loadAdminCatalogProducts } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

const ADMIN_TIME_ZONE = "Asia/Manila";

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function getCustomerName(order: Record<string, any>) {
  return order.customer_name || order.email || "Guest customer";
}

function getStatusTone(status: string): "paid" | "processing" | "pending" | "cancelled" | "shipped" {
  if (status === "paid") {
    return "paid";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "processing";
}

function getDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function formatSalesPointLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(getDateFromKey(dateKey));
}

function shiftDate(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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

function buildSalesOverviewDatasets(payments: Array<Record<string, any>>): AdminSalesDataset[] {
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const totalsByDate = paidPayments.reduce<Map<string, number>>((totals, payment) => {
    const dateKey = getDateKey(payment.updated_at || payment.created_at);
    totals.set(dateKey, (totals.get(dateKey) || 0) + toNumber(payment.amount_expected_fiat));
    return totals;
  }, new Map());
  const today = new Date();
  const todayKey = getDateKey(today);
  const monthStart = new Date(today);
  monthStart.setDate(1);
  const paidDateKeys = [...totalsByDate.keys()].sort();
  const allTimeDays = paidDateKeys.length ? paidDateKeys : [todayKey];

  function pointsFor(days: string[]) {
    return days.map((dateKey) => ({
      key: dateKey,
      label: formatSalesPointLabel(dateKey),
      value: totalsByDate.get(dateKey) || 0,
    }));
  }

  return [
    {
      key: "today",
      label: "Today",
      description: "Confirmed payment value for today.",
      points: pointsFor([todayKey]),
    },
    {
      key: "last7",
      label: "Last 7 days",
      description: "Confirmed payment value across the last 7 days.",
      points: pointsFor(getDateRange(shiftDate(today, -6), today)),
    },
    {
      key: "last30",
      label: "Last 30 days",
      description: "Confirmed payment value across the last 30 days.",
      points: pointsFor(getDateRange(shiftDate(today, -29), today)),
    },
    {
      key: "month",
      label: "This month",
      description: "Confirmed payment value for the current month.",
      points: pointsFor(getDateRange(monthStart, today)),
    },
    {
      key: "all",
      label: "All time",
      description: "Confirmed payment value across all available payment records.",
      points: pointsFor(allTimeDays),
    },
  ];
}

export default async function AdminPage() {
  await requireManagementUser();

  let orders: Array<Record<string, any>> = [];
  let payments: Array<Record<string, any>> = [];
  let profiles: Array<Record<string, any>> = [];
  let products: CatalogProduct[] = [];
  const loadErrors: string[] = [];

  try {
    const admin = createSupabaseAdminClient();
    const [ordersResult, paymentsResult, profilesResult] = await Promise.all([
      admin.from("orders").select("*").order("created_at", { ascending: false }),
      admin.from("payments").select("*").order("created_at", { ascending: false }),
      admin.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);

    orders = ordersResult.data || [];
    payments = paymentsResult.data || [];
    profiles = profilesResult.data || [];

    [ordersResult.error?.message, paymentsResult.error?.message, profilesResult.error?.message]
      .filter(Boolean)
      .forEach((error) => loadErrors.push(error as string));
  } catch (error) {
    loadErrors.push(getErrorMessage(error, "Unable to load admin dashboard data right now."));
  }

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadErrors.push(getErrorMessage(error, "Unable to load product inventory right now."));
  }

  const lowStockProducts = products.filter((product) => getProductStock(product) <= 2);
  const recentOrders = orders.slice(0, 5);
  const topProducts = products.slice(0, 5);
  const salesDatasets = buildSalesOverviewDatasets(payments);
  const persistedNotifications = await loadAdminNotificationCenterRows();
  const notifications = [
    ...loadErrors.map((error, index) => ({
      id: `load-error-${index}`,
      title: "Admin data warning",
      copy: error,
    })),
    ...persistedNotifications,
  ];

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Welcome back, Vione! 👋" subtitle="Here's what's happening with your store today.">
        <AdminNotificationsMenu notifications={notifications} />
        <AdminLiveRefresh />
      </AdminPageHeader>

      {loadErrors.length ? (
        <div className="vh-admin-alert">
          {loadErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <AdminDashboardSummary
        orders={orders.map((order) => ({
          id: order.id,
          status: order.status,
          email: order.email,
          customer_name: order.customer_name,
          created_at: order.created_at,
        }))}
        payments={payments.map((payment) => ({
          status: payment.status,
          amount_expected_fiat: payment.amount_expected_fiat,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
        }))}
        profiles={profiles.map((profile) => ({
          id: profile.id,
          created_at: profile.created_at,
        }))}
      />

      <div className="vh-admin-dashboard-grid">
        <AdminSalesOverview datasets={salesDatasets} />

        <section className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Top Products</h2>
              <p>Current catalog priority.</p>
            </div>
            <Link href="/admin/products">View all</Link>
          </div>
          <div className="vh-admin-product-list">
            {topProducts.length ? (
              topProducts.map((product) => (
                <Link href="/admin/products" key={product.id} className="vh-admin-product-row">
                  <img src={product.image} alt={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatAmountWithUnit(product.pricePhpCents / 100, "PHP")}</span>
                  </div>
                  <small>
                    Stock
                    <b>{getProductStock(product)}</b>
                  </small>
                </Link>
              ))
            ) : (
              <EmptyAdminState title="No products yet" copy="Products will appear here after they are created." />
            )}
          </div>
        </section>

        <section className="vh-admin-panel vh-admin-panel--activity">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Activity Feed</h2>
              <p>Latest operational movement.</p>
            </div>
          </div>
          <div className="vh-admin-activity-feed">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <Link key={order.id} href="/admin/orders" className="vh-admin-activity-item">
                  <span aria-hidden="true" />
                  <div>
                    <strong>Order {order.order_number || order.id}</strong>
                    <p>{getCustomerName(order)} · {formatDateTime(order.created_at)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyAdminState title="No activity yet" copy="New orders and payments will appear here." />
            )}
          </div>
        </section>

        <section className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Recent Orders</h2>
              <p>Newest customer order records.</p>
            </div>
            <Link href="/admin/orders">View all orders</Link>
          </div>
          <div className="vh-admin-table-scroll">
            <table className="vh-admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href="/admin/orders">#{order.order_number || order.id}</Link>
                    </td>
                    <td>{getCustomerName(order)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                    <td>{formatAmountWithUnit(order.amount, order.currency)}</td>
                    <td>
                      <AdminStatusBadge tone={getStatusTone(order.status)}>{order.status}</AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Low Stock Products</h2>
              <p>Items that need inventory attention.</p>
            </div>
            <Link href="/admin/products">View all</Link>
          </div>
          <div className="vh-admin-product-list">
            {lowStockProducts.length ? (
              lowStockProducts.slice(0, 5).map((product) => (
                <Link href="/admin/products" key={product.id} className="vh-admin-product-row">
                  <img src={product.image} alt={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <span>SKU: {product.id}</span>
                  </div>
                  <small>
                    Stock
                    <b>{getProductStock(product)}</b>
                  </small>
                </Link>
              ))
            ) : (
              <EmptyAdminState title="Inventory looks clear" copy="No products are currently at the low-stock threshold." />
            )}
          </div>
        </section>
      </div>

      <footer className="vh-admin-copyright">© 2026 Vione Hernal. All rights reserved.</footer>
    </div>
  );
}
