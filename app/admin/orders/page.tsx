import Link from "next/link";

import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { requireOrderOperationsUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { buildOrderItemsByOrderId, getOrderDisplayLines } from "@/lib/order-items";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

function getHistoryBadgeClass(status: string) {
  if (status === "paid") {
    return "vh-badge--paid";
  }

  if (status === "cancelled") {
    return "vh-badge--cancelled";
  }

  return "vh-badge--pending";
}

function getHistoryStatusLabel(status: string) {
  if (status === "paid") {
    return "Paid / Confirmed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return "Pending";
}

export default async function AdminOrdersPage() {
  const { role, isManagementUser } = await requireOrderOperationsUser();
  let orders: Array<Record<string, any>> = [];
  let loadError = "";
  let orderItems: Array<Record<string, any>> = [];

  try {
    const admin = createSupabaseAdminClient();
    const [{ data, error }, { data: orderItemsData, error: orderItemsError }] = await Promise.all([
      admin.from("orders").select("*").order("created_at", { ascending: false }),
      admin.from("order_items").select("*").order("created_at", { ascending: true }),
    ]);

    if (error) {
      loadError = error.message;
    } else if (orderItemsError) {
      loadError = orderItemsError.message;
    } else {
      orders = data || [];
      orderItems = orderItemsData || [];
    }
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load order operations right now.");
  }
  const orderItemsByOrderId = buildOrderItemsByOrderId(orderItems as any);

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
                {(() => {
                  const lineItems = orderItemsByOrderId.get(order.id) ?? [];
                  const orderLines = getOrderDisplayLines(order as any, lineItems as any);
                  const shippingSummary = [order.shipping_method, order.shipping_fee ? formatAmountWithUnit(order.shipping_fee, "PHP") : null]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div className="vh-history-card">
                      <div className="vh-history-card__header">
                        <div className="vh-history-card__identity">
                          <p className="vh-history-card__label">Order</p>
                          <p className="vh-history-card__id">{order.order_number || order.id}</p>
                          <p className="vh-history-card__timestamp">{formatDateTime(order.created_at)}</p>
                        </div>
                        <div className="vh-history-card__status">
                          <span className={`vh-badge ${getHistoryBadgeClass(order.status)}`}>
                            {getHistoryStatusLabel(order.status)}
                          </span>
                        </div>
                      </div>

                      <div className="vh-history-card__metrics">
                        <div className="vh-history-metric vh-history-metric--focus">
                          <span className="vh-history-metric__label">Checkout Total</span>
                          <strong className="vh-history-metric__value">
                            {formatAmountWithUnit(order.amount, order.currency)}
                          </strong>
                        </div>
                        <div className="vh-history-metric">
                          <span className="vh-history-metric__label">Shipping</span>
                          <strong className="vh-history-metric__value">{shippingSummary || "Not set"}</strong>
                        </div>
                        <div className="vh-history-metric">
                          <span className="vh-history-metric__label">Confirmation Email</span>
                          <strong className="vh-history-metric__value">{order.confirmation_email_status}</strong>
                        </div>
                      </div>

                      <div className="vh-history-card__sections">
                        <section className="vh-history-card__section">
                          <p className="vh-history-card__section-title">Customer / Order Summary</p>
                          <div className="vh-history-card__detail-grid">
                            <div className="vh-history-card__detail">
                              <span className="vh-history-card__detail-label">Email</span>
                              <p className="vh-history-card__detail-value">{order.email || "No email recorded"}</p>
                            </div>
                            <div className="vh-history-card__detail">
                              <span className="vh-history-card__detail-label">Customer</span>
                              <p className="vh-history-card__detail-value">{order.customer_name || "Not set"}</p>
                            </div>
                            {orderLines.length ? (
                              <div className="vh-history-card__detail vh-history-card__detail--full">
                                <span className="vh-history-card__detail-label">Items</span>
                                <div className="vh-history-card__stack">
                                  {orderLines.map((line) => (
                                    <p key={line} className="vh-history-card__detail-value">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <div className="vh-history-card__detail vh-history-card__detail--full">
                              <span className="vh-history-card__detail-label">Shipping Address</span>
                              <p className="vh-history-card__detail-value">{order.shipping_address || "Not set"}</p>
                            </div>
                          </div>
                        </section>
                      </div>

                      <div className="vh-history-card__action">
                        {role === "staff" && order.status === "paid" ? (
                          <div className="vh-status">Paid orders are view-only for staff.</div>
                        ) : (
                          <AdminOrderStatusForm
                            orderId={order.id}
                            initialStatus={order.status}
                            allowedStatuses={role === "staff" ? ["pending", "cancelled"] : undefined}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}
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
