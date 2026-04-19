import Link from "next/link";

import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { requireOrderOperationsUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

export default async function AdminOrdersPage() {
  const { role, isManagementUser } = await requireOrderOperationsUser();
  let orders: Array<Record<string, any>> = [];
  let loadError = "";

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("orders").select("*").order("created_at", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      orders = data || [];
    }
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load order operations right now.");
  }

  return (
    <section className="vh-page-shell">
      <div className="vh-data-card">
        <p className="vh-mvp-eyebrow">Order Operations</p>
        <h1 className="vh-mvp-title">Review live and cancelled orders without opening finance tools.</h1>
        <p className="vh-mvp-copy">
          Effective role: {role}. This page is limited to order operations. Ledger data, allocations, payment finance,
          and permission management stay outside the staff workflow.
        </p>
        <div className="vh-actions">
          <Link className="vh-button vh-button--ghost" href="/dashboard">
            Back To Dashboard
          </Link>
          {isManagementUser ? (
            <Link className="vh-button vh-button--ghost" href="/admin">
              Open Admin
            </Link>
          ) : null}
        </div>
        {loadError ? <div className="vh-status vh-status--error">{loadError}</div> : null}
      </div>

      <section className="vh-data-card" style={{ marginTop: "2rem" }}>
        <h2 className="h3 u-margin-b--lg">All Orders</h2>
        <div className="vh-list">
          {orders.length ? (
            orders.map((order) => (
              <article key={order.id} className="vh-history-item">
                <strong>{order.order_number || order.id}</strong>
                <p className="u-margin-b--none">{order.email || "No email recorded"}</p>
                {order.product_name ? (
                  <p className="u-margin-b--none">
                    {order.product_name}
                    {order.selected_size ? ` · Size ${order.selected_size}` : ""}
                    {order.quantity ? ` · Qty ${order.quantity}` : ""}
                  </p>
                ) : null}
                <p className="u-margin-b--none">{order.customer_name}</p>
                <p className="u-margin-b--none">{order.shipping_address}</p>
                <p className="u-margin-b--none">{formatAmountWithUnit(order.amount, order.currency)}</p>
                <p className="u-margin-b--none">Status: {order.status}</p>
                <p className="u-margin-b--none">Confirmation Email: {order.confirmation_email_status}</p>
                <p className="u-margin-b--none" style={{ color: "#6c6c6c" }}>
                  {formatDateTime(order.created_at)}
                </p>
                {role === "staff" && order.status === "paid" ? (
                  <div className="vh-status" style={{ marginTop: "1rem" }}>
                    Paid orders are view-only for staff.
                  </div>
                ) : (
                  <AdminOrderStatusForm
                    orderId={order.id}
                    initialStatus={order.status}
                    allowedStatuses={role === "staff" ? ["pending", "cancelled"] : undefined}
                  />
                )}
              </article>
            ))
          ) : (
            <div className="vh-empty">No orders yet.</div>
          )}
        </div>
      </section>
    </section>
  );
}
