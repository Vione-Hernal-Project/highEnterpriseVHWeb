import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { ProfileRoleForm } from "@/components/admin/profile-role-form";
import { requireManagementUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
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

export default async function AdminPage() {
  const { role, isOwner } = await requireManagementUser();
  let orders: Array<Record<string, any>> = [];
  let payments: Array<Record<string, any>> = [];
  let profiles: Array<Record<string, any>> = [];
  let adminError = "";

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

    adminError =
      ordersResult.error?.message || paymentsResult.error?.message || profilesResult.error?.message || "";
  } catch (error) {
    adminError = getErrorMessage(error, "Unable to load the management data right now.");
  }

  return (
    <section className="vh-page-shell">
      <div className="vh-data-card">
        <p className="vh-mvp-eyebrow">Store Management</p>
        <h1 className="vh-mvp-title">Orders, payments, and customer access controls.</h1>
        <p className="vh-mvp-copy">
          This area is protected on the server. Effective role: {role}. Use it to review orders, inspect Sepolia
          payment records, inspect the live allocation ledger, adjust order status when needed, manage product launches,
          and manage admin access.
        </p>
        {adminError ? <div className="vh-status vh-status--error">{adminError}</div> : null}
        <div className="vh-actions">
          <Link className="vh-button" href="/admin/products">
            Manage Products
          </Link>
          <Link className="vh-button vh-button--ghost" href="/admin/orders">
            Open Order Operations
          </Link>
          <Link className="vh-button" href="/admin/ledger">
            Open Allocation Ledger
          </Link>
          <Link className="vh-button vh-button--ghost" href="/dashboard">
            Back To Dashboard
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section className="vh-data-card" style={{ marginTop: "2rem" }}>
        <p className="vh-mvp-eyebrow">Product Launches</p>
        <h2 className="h3 u-margin-b--sm">Add new products without touching frontend code.</h2>
        <p className="vh-mvp-copy" style={{ marginTop: 0 }}>
          Use the product manager to upload images, save drafts, publish products, and control Shop, New Arrivals, and
          Featured Items placement from one admin screen.
        </p>
        <div className="vh-actions">
          <Link className="vh-button vh-button--ghost" href="/admin/products">
            Open Product Manager
          </Link>
        </div>
      </section>

      <section className="vh-data-card" style={{ marginTop: "2rem" }}>
        <p className="vh-mvp-eyebrow">Live Monitoring</p>
        <h2 className="h3 u-margin-b--sm">Fund allocation now has its own admin dashboard.</h2>
        <p className="vh-mvp-copy" style={{ marginTop: 0 }}>
          Open the allocation ledger to watch successful payments stream in, inspect source-of-funds metadata, review
          the live payment-distribution split, and keep the VHL token-allocation framework visible in the same view.
        </p>
        <div className="vh-actions">
          <Link className="vh-button vh-button--ghost" href="/admin/ledger">
            Go To Ledger
          </Link>
        </div>
      </section>

      <div className="vh-admin-columns" style={{ marginTop: "2rem" }}>
        <section className="vh-data-card">
          <h2 className="h3 u-margin-b--lg">All Orders</h2>
          <div className="vh-list">
            {orders?.length ? (
              orders.map((order) => (
                <article key={order.id} className="vh-history-item">
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
                        <strong className="vh-history-metric__value">
                          {[order.shipping_method, order.shipping_fee ? formatAmountWithUnit(order.shipping_fee, "PHP") : null]
                            .filter(Boolean)
                            .join(" · ") || "Not set"}
                        </strong>
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
                            <span className="vh-history-card__detail-label">Customer</span>
                            <p className="vh-history-card__detail-value">{order.customer_name || "Not set"}</p>
                          </div>
                          <div className="vh-history-card__detail">
                            <span className="vh-history-card__detail-label">Email</span>
                            <p className="vh-history-card__detail-value">{order.email || "No email recorded"}</p>
                          </div>
                          <div className="vh-history-card__detail">
                            <span className="vh-history-card__detail-label">Phone</span>
                            <p className="vh-history-card__detail-value">{order.phone || "Not set"}</p>
                          </div>
                          <div className="vh-history-card__detail">
                            <span className="vh-history-card__detail-label">Item Summary</span>
                            <p className="vh-history-card__detail-value">
                              {order.product_name
                                ? `${order.product_name}${order.quantity ? ` · Qty ${order.quantity}` : ""}`
                                : "No product summary recorded"}
                            </p>
                          </div>
                          <div className="vh-history-card__detail vh-history-card__detail--full">
                            <span className="vh-history-card__detail-label">Shipping Address</span>
                            <p className="vh-history-card__detail-value">{order.shipping_address || "Not set"}</p>
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="vh-history-card__action">
                      <AdminOrderStatusForm orderId={order.id} initialStatus={order.status} />
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="vh-empty">No orders yet.</div>
            )}
          </div>
        </section>

        <section className="vh-data-card">
          <h2 className="h3 u-margin-b--lg">All Payments</h2>
          <div className="vh-list">
            {payments?.length ? (
              <>
                <div className="vh-history-helper">
                  <strong>Manual On-Chain Check</strong>
                  <p>
                    Compare expected vs received amount, confirm the recipient wallet matches the merchant wallet, then
                    use the tx hash in a block explorer to inspect the transfer externally.
                  </p>
                </div>
                {payments.map((payment) => (
                  <article key={payment.id} className="vh-history-item">
                    <div className="vh-history-card">
                      <div className="vh-history-card__header">
                        <div className="vh-history-card__identity">
                          <p className="vh-history-card__label">Payment</p>
                          <p className="vh-history-card__id">{payment.id}</p>
                          <p className="vh-history-card__timestamp">{formatDateTime(payment.created_at)}</p>
                        </div>
                        <div className="vh-history-card__status">
                          <span className={`vh-badge ${getHistoryBadgeClass(payment.status)}`}>
                            {getHistoryStatusLabel(payment.status)}
                          </span>
                        </div>
                      </div>

                      <div className="vh-history-card__metrics">
                        <div className="vh-history-metric vh-history-metric--focus">
                          <span className="vh-history-metric__label">Expected Amount</span>
                          <strong className="vh-history-metric__value">
                            {formatAmountWithUnit(payment.amount_expected, getPaymentMethodLabel(payment.payment_method))}
                          </strong>
                        </div>
                        <div className="vh-history-metric vh-history-metric--focus">
                          <span className="vh-history-metric__label">Received Amount</span>
                          <strong className="vh-history-metric__value">
                            {payment.amount_received
                              ? formatAmountWithUnit(payment.amount_received, getPaymentMethodLabel(payment.payment_method))
                              : "Awaiting confirmation"}
                          </strong>
                        </div>
                        <div className="vh-history-metric">
                          <span className="vh-history-metric__label">Checkout Total</span>
                          <strong className="vh-history-metric__value">
                            {payment.amount_expected_fiat && payment.fiat_currency
                              ? formatAmountWithUnit(payment.amount_expected_fiat, payment.fiat_currency)
                              : "Not set"}
                          </strong>
                        </div>
                        <div className="vh-history-metric">
                          <span className="vh-history-metric__label">Payment Method</span>
                          <strong className="vh-history-metric__value">
                            {getPaymentMethodLabel(payment.payment_method)}
                          </strong>
                        </div>
                      </div>

                      <div className="vh-history-card__sections">
                        <section className="vh-history-card__section">
                          <p className="vh-history-card__section-title">Payment Details</p>
                          <div className="vh-history-card__detail-grid">
                            <div className="vh-history-card__detail">
                              <span className="vh-history-card__detail-label">Order ID</span>
                              <p className="vh-history-card__detail-value">{payment.order_id || "Not linked"}</p>
                            </div>
                            <div className="vh-history-card__detail">
                              <span className="vh-history-card__detail-label">Locked Rate</span>
                              <p className="vh-history-card__detail-value">
                                {payment.conversion_rate
                                  ? `${formatAmountWithUnit(payment.conversion_rate, "PHP")} / ETH`
                                  : "Not set"}
                              </p>
                            </div>
                          </div>
                        </section>

                        <section className="vh-history-card__section">
                          <p className="vh-history-card__section-title">Wallet / On-Chain Details</p>
                          <div className="vh-history-card__detail-grid">
                            <div className="vh-history-card__detail vh-history-card__detail--full">
                              <span className="vh-history-card__detail-label">Recipient Wallet</span>
                              <p className="vh-history-card__detail-value vh-history-card__detail-value--mono">
                                {payment.recipient_address || "Not submitted"}
                              </p>
                            </div>
                            <div className="vh-history-card__detail vh-history-card__detail--full">
                              <span className="vh-history-card__detail-label">Tx Hash</span>
                              <p className="vh-history-card__detail-value vh-history-card__detail-value--mono">
                                {payment.tx_hash || "Not submitted"}
                              </p>
                            </div>
                            <div className="vh-history-card__detail vh-history-card__detail--full">
                              <span className="vh-history-card__detail-label">Payer Wallet</span>
                              <p className="vh-history-card__detail-value vh-history-card__detail-value--mono">
                                {payment.wallet_address || "Not submitted"}
                              </p>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            ) : (
              <div className="vh-empty">No payments yet.</div>
            )}
          </div>
        </section>
      </div>

      <section className="vh-data-card" style={{ marginTop: "2rem" }}>
        <h2 className="h3 u-margin-b--lg">Profiles</h2>
        <div className="vh-list">
          {profiles?.length ? (
            profiles.map((profile) => (
              <article key={profile.id} className="vh-history-item">
                <strong>{profile.email || "No email"}</strong>
                <p className="u-margin-b--none">Role: {profile.role}</p>
                <p className="u-margin-b--none">Wallet: {profile.wallet_address || "Not set"}</p>
                {isOwner && profile.role !== "owner" ? <ProfileRoleForm profileId={profile.id} initialRole={profile.role} /> : null}
              </article>
            ))
          ) : (
            <div className="vh-empty">No profiles yet.</div>
          )}
        </div>
      </section>
    </section>
  );
}
