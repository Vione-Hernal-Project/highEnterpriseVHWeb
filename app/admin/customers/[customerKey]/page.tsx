import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText, ShoppingBag, UserRound } from "lucide-react";

import { AdminPageHeader, AdminStatCard, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-ui";
import { requireManagementUser } from "@/lib/auth";
import { loadAdminManualCustomers } from "@/lib/customers";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

type Props = {
  params: Promise<{
    customerKey: string;
  }>;
};

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getCustomerKey(order: Record<string, any>) {
  return String(order.email || order.customer_name || order.user_id || order.id).trim().toLowerCase();
}

function getStatusTone(status: string): "paid" | "processing" | "pending" | "cancelled" {
  if (status === "paid") return "paid";
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "pending";
  return "processing";
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  await requireManagementUser();
  const { customerKey } = await params;
  const decodedKey = decodeURIComponent(customerKey);
  const admin = createSupabaseAdminClient();
  const [{ data: orders }, { data: profiles }] = await Promise.all([
    admin.from("orders").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
  ]);
  const manualCustomers = await loadAdminManualCustomers().catch(() => []);
  const customerOrders = (orders || []).filter((order) => getCustomerKey(order) === decodedKey);
  const profile = (profiles || []).find((item) => String(item.email || item.id).trim().toLowerCase() === decodedKey);
  const manualCustomer = manualCustomers.find((customer) => customer.email.trim().toLowerCase() === decodedKey || `manual:${customer.id}` === decodedKey);

  if (!customerOrders.length && !profile && !manualCustomer) {
    notFound();
  }

  const latestOrder = customerOrders[0] || {};
  const customerName = manualCustomer?.fullName || latestOrder.customer_name || profile?.email || decodedKey;
  const email = manualCustomer?.email || latestOrder.email || profile?.email || "Not recorded";
  const paidOrders = customerOrders.filter((order) => order.status === "paid");
  const totalSpent = paidOrders.reduce((total, order) => total + toNumber(order.amount), 0);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={customerName} subtitle="Customer profile, order history, and payment activity.">
        <Link className="vh-admin-action-button" href="/admin/customers">
          <ArrowLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Back to Customers</span>
        </Link>
      </AdminPageHeader>

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four">
        <AdminStatCard href="/admin/customers" label="Customer" value={profile ? "Profile" : "Guest"} delta={email} icon={UserRound} />
        <AdminStatCard href="/admin/orders" label="Orders" value={customerOrders.length} delta="Total order records" tone="blue" icon={ReceiptText} />
        <AdminStatCard href="/admin/payments" label="Paid Orders" value={paidOrders.length} delta="Confirmed order count" tone="green" icon={ShoppingBag} />
        <AdminStatCard href="/admin/reports" label="Total Spent" value={formatAmountWithUnit(totalSpent, "PHP")} delta="Paid orders only" tone="purple" icon={ShoppingBag} />
      </section>

      <AdminTableShell tabs={["All Orders", "Paid", "Pending", "Cancelled"]} searchPlaceholder="Search this customer history..." filters={["Filter"]}>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all customer orders" /></th>
              <th>Order ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customerOrders.length ? customerOrders.map((order) => (
              <tr
                key={order.id}
                data-admin-table-row="true"
                data-admin-row-id={order.id}
                data-admin-row-href={`/admin/orders/${order.id}`}
                data-admin-status={order.status}
              >
                <td><input type="checkbox" aria-label={`Select ${order.order_number || order.id}`} /></td>
                <td><Link className="vh-admin-table__link" href={`/admin/orders/${order.id}`}>{order.order_number || order.id}</Link></td>
                <td>{formatDateTime(order.created_at)}</td>
                <td>{formatAmountWithUnit(order.amount, order.currency || "PHP")}</td>
                <td><AdminStatusBadge tone={getStatusTone(order.status)}>{order.status}</AdminStatusBadge></td>
                <td>{order.shipping_city || order.shipping_country || "Not recorded"}</td>
                <td><Link className="vh-admin-view-button" href={`/admin/orders/${order.id}`}>View</Link></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>
                  <div className="vh-admin-empty-state">
                    <strong>No orders yet.</strong>
                    <p>This customer profile does not have order activity yet.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
