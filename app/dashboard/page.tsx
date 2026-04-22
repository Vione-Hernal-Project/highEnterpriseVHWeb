import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { CancelOrderButton } from "@/components/dashboard/cancel-order-button";
import { PaymentStatusButton } from "@/components/dashboard/payment-status-button";
import { WalletAddressForm } from "@/components/dashboard/wallet-address-form";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { buildOrderItemsByOrderId, getOrderDisplayLines } from "@/lib/order-items";
import { formatAmountWithUnit, getPaymentMethodConfig, getPaymentMethodLabel } from "@/lib/payments/options";
import { formatDateTime, formatWalletAddress } from "@/lib/utils";

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

function getConfirmationEmailLabel(status: string | null) {
  if (!status) {
    return "Not available";
  }

  if (status === "sent") {
    return "Sent";
  }

  if (status === "pending") {
    return "Queued";
  }

  if (status === "failed") {
    return "Needs attention";
  }

  if (status === "not_configured") {
    return "Not configured";
  }

  return status.replace(/_/g, " ");
}

export default async function DashboardPage() {
  const { supabase, user, profile, role, canManageOrders, isManagementUser } = await requireUser();

  const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }, { data: orderItems, error: orderItemsError }] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("order_items").select("*").order("created_at", { ascending: true }),
  ]);
  const orderItemsByOrderId = buildOrderItemsByOrderId(orderItems || []);
  const paymentByOrderId = new Map<string, Database["public"]["Tables"]["payments"]["Row"]>();

  (payments || []).forEach((payment) => {
    if (!payment.order_id || paymentByOrderId.has(payment.order_id)) {
      return;
    }

    paymentByOrderId.set(payment.order_id, payment);
  });

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Dashboard</p>
          <h1 className="vh-mvp-title">Your account, orders, and payment attempts.</h1>
          <p className="vh-mvp-copy">
            This is the protected customer area for the Vione Hernal MVP. It is backed by Supabase Auth and row-level
            security, and it now tracks your Sepolia payment attempts and order history.
          </p>
          <div className="vh-actions">
            <Link className="vh-button" href="/shop">
              Shop Collection
            </Link>
            {canManageOrders ? (
              <Link className="vh-button vh-button--ghost" href="/admin/orders">
                View Orders
              </Link>
            ) : null}
            {isManagementUser ? (
              <Link className="vh-button vh-button--ghost" href="/admin">
                Manage Store
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>

        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Profile</p>
          <div className="vh-list">
            <div>
              <strong>Email</strong>
              <p className="u-margin-b--none">{profile?.email || user.email}</p>
            </div>
            <div>
              <strong>Role</strong>
              <p className="u-margin-b--none">{role}</p>
            </div>
            <div>
              <strong>Wallet Placeholder</strong>
              <p className="u-margin-b--none">{formatWalletAddress(profile?.wallet_address)}</p>
            </div>
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <WalletAddressForm initialWalletAddress={profile?.wallet_address || null} />
          </div>
        </div>
      </div>

      {ordersError || paymentsError || orderItemsError ? (
        <div className="vh-status vh-status--error" style={{ marginTop: "2rem" }}>
          Supabase commerce tables are not set up yet. Run `supabase/schema.sql` in the Supabase SQL Editor, then
          refresh and try again. 
        </div>
      ) : null}

      <div className="vh-admin-columns vh-dashboard-history" style={{ marginTop: "2rem" }}>
        <section className="vh-data-card vh-dashboard-history__column">
          <div className="vh-dashboard-history__heading">
            <div>
              <h2 className="h3 u-margin-b--sm">Order History</h2>
              <p className="vh-dashboard-history__meta">
                Review status, totals, and delivery details at a glance.
              </p>
            </div>
            {orders?.length ? <span className="vh-dashboard-history__count">{orders.length} item{orders.length === 1 ? "" : "s"}</span> : null}
          </div>
          {orders?.length ? (
            <div className="vh-list vh-dashboard-history__list">
              {orders.map((order) => (
                <article key={order.id} className="vh-history-item">
                  {(() => {
                    const lineItems = orderItemsByOrderId.get(order.id) ?? [];
                    const relatedPayment = paymentByOrderId.get(order.id);
                    const orderLines = getOrderDisplayLines(order, lineItems);
                    const shippingSummary = [order.shipping_method, order.shipping_fee ? formatAmountWithUnit(order.shipping_fee, "PHP") : null]
                      .filter(Boolean)
                      .join(" · ");
                    const canCancelOrder =
                      order.status === "pending" &&
                      (!relatedPayment || (!relatedPayment.tx_hash && relatedPayment.status !== "paid" && relatedPayment.status !== "cancelled"));
                    const isAwaitingConfirmation = order.status === "pending" && Boolean(relatedPayment?.tx_hash) && relatedPayment?.status === "pending";
                    const orderStatusLabel = isAwaitingConfirmation ? "Waiting for on-chain confirmation" : getHistoryStatusLabel(order.status);
                    const supportHref = `mailto:vionehernal@gmail.com?subject=${encodeURIComponent(
                      `${order.status === "paid" ? "Refund / Support" : "Payment Support"} ${order.order_number || order.id}`,
                    )}`;

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
                              {orderStatusLabel}
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
                            <strong className="vh-history-metric__value">{getConfirmationEmailLabel(order.confirmation_email_status)}</strong>
                          </div>
                        </div>

                        <div className="vh-history-card__sections">
                          <section className="vh-history-card__section">
                            <p className="vh-history-card__section-title">Customer / Order Summary</p>
                            <div className="vh-history-card__detail-grid">
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
                              <div className="vh-history-card__detail">
                                <span className="vh-history-card__detail-label">Customer</span>
                                <p className="vh-history-card__detail-value">{order.customer_name || "Not set"}</p>
                              </div>
                              <div className="vh-history-card__detail vh-history-card__detail--full">
                                <span className="vh-history-card__detail-label">Shipping Address</span>
                                <p className="vh-history-card__detail-value">{order.shipping_address || "Not set"}</p>
                              </div>
                              <div className="vh-history-card__detail vh-history-card__detail--full">
                                <span className="vh-history-card__detail-label">Notes</span>
                                <p className="vh-history-card__detail-value">{order.notes || "No note added."}</p>
                              </div>
                            </div>
                          </section>
                        </div>

                        {canCancelOrder ? (
                          <div className="vh-history-card__action">
                            <CancelOrderButton orderId={order.id} />
                          </div>
                        ) : isAwaitingConfirmation ? (
                          <div className="vh-status">
                            Submitted on-chain. Normal cancellation is disabled while confirmation is pending. For urgent help,{" "}
                            <a href={supportHref}>contact support</a>.
                          </div>
                        ) : order.status === "paid" ? (
                          <div className="vh-status">
                            For refunds or post-purchase support, <a href={supportHref}>contact Vione Hernal support</a>.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </article>
              ))}
            </div>
          ) : (
            <div className="vh-empty">You have no orders yet.</div>
          )}
        </section>

        <section className="vh-data-card vh-dashboard-history__column">
          <div className="vh-dashboard-history__heading">
            <div>
              <h2 className="h3 u-margin-b--sm">Payment History</h2>
              <p className="vh-dashboard-history__meta">
                Scan expected amounts, on-chain details, and confirmation status quickly.
              </p>
            </div>
            {payments?.length ? <span className="vh-dashboard-history__count">{payments.length} item{payments.length === 1 ? "" : "s"}</span> : null}
          </div>
          {payments?.length ? (
            <div className="vh-list vh-dashboard-history__list">
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
                                : "Waiting for on-chain confirmation"}
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
                          {payment.order_id ? (
                            <div className="vh-history-card__detail">
                              <span className="vh-history-card__detail-label">Order ID</span>
                              <p className="vh-history-card__detail-value">{payment.order_id}</p>
                            </div>
                          ) : null}
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

                    {payment.status === "pending" && getPaymentMethodConfig(payment.payment_method) ? (
                      <div className="vh-history-card__action">
                        <PaymentStatusButton
                          paymentId={payment.id}
                          paymentMethod={payment.payment_method}
                          amountExpected={payment.amount_expected}
                          recipientAddress={payment.recipient_address}
                          txHash={payment.tx_hash}
                          walletAddress={payment.wallet_address}
                        />
                      </div>
                    ) : payment.status === "pending" ? (
                      <div className="vh-status">
                        This payment record was created before the Sepolia wallet flow was enabled.
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="vh-empty">No payment attempts yet.</div>
          )}
        </section>
      </div>
    </section>
  );
}
