import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { CancelOrderButton } from "@/components/dashboard/cancel-order-button";
import { PaymentStatusButton } from "@/components/dashboard/payment-status-button";
import { WalletAddressForm } from "@/components/dashboard/wallet-address-form";
import { requireUser } from "@/lib/auth";
import { formatAmountWithUnit, getPaymentMethodConfig, getPaymentMethodLabel } from "@/lib/payments/options";
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, user, profile, role, isManagementUser } = await requireUser();

  const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

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
            <Link className="vh-button" href="/">
              Shop Collection
            </Link>
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

      {ordersError || paymentsError ? (
        <div className="vh-status vh-status--error" style={{ marginTop: "2rem" }}>
          Supabase commerce tables are not set up yet. Run `supabase/schema.sql` in the Supabase SQL Editor, then
          refresh and try again. 
        </div>
      ) : null}

      <div className="vh-admin-columns" style={{ marginTop: "2rem" }}>
        <section className="vh-data-card">
          <h2 className="h3 u-margin-b--lg">Order History</h2>
          {orders?.length ? (
            <div className="vh-list">
              {orders.map((order) => (
                <article key={order.id} className="vh-history-item">
                  <div className="vh-history-row">
                    <div>
                      <p className="vh-mvp-eyebrow">Order</p>
                      <strong>{order.order_number || order.id}</strong>
                    </div>
                    <span
                      className={`vh-badge ${
                        order.status === "paid"
                          ? "vh-badge--paid"
                          : order.status === "cancelled"
                            ? "vh-badge--cancelled"
                            : "vh-badge--pending"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p style={{ marginTop: "0.75rem" }}>{formatAmountWithUnit(order.amount, order.currency)}</p>
                  {order.product_name ? (
                    <p className="u-margin-b--none">
                      {order.product_name}
                      {order.quantity ? ` · Qty ${order.quantity}` : ""}
                    </p>
                  ) : null}
                  <p className="u-margin-b--none">{order.customer_name}</p>
                  <p className="u-margin-b--none">{order.shipping_address}</p>
                  <p className="u-margin-b--none">{order.notes || "No note added."}</p>
                  <p className="u-margin-b--none" style={{ marginTop: "0.65rem" }}>
                    Confirmation Email: {order.confirmation_email_status}
                  </p>
                  <p className="u-margin-b--none" style={{ marginTop: "0.65rem", color: "#6c6c6c" }}>
                    {formatDateTime(order.created_at)}
                  </p>
                  {order.status === "pending" ? (
                    <div style={{ marginTop: "1rem" }}>
                      <CancelOrderButton orderId={order.id} />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="vh-empty">You have no orders yet.</div>
          )}
        </section>

        <section className="vh-data-card">
          <h2 className="h3 u-margin-b--lg">Payment History</h2>
          {payments?.length ? (
            <div className="vh-list">
              {payments.map((payment) => (
                <article key={payment.id} className="vh-history-item">
                  <div className="vh-history-row">
                    <div>
                      <p className="vh-mvp-eyebrow">Payment</p>
                      <strong>{payment.id}</strong>
                    </div>
                    <span className={`vh-badge ${payment.status === "paid" ? "vh-badge--paid" : "vh-badge--pending"}`}>
                      {payment.status}
                    </span>
                  </div>
                  <p style={{ marginTop: "0.75rem" }}>
                    Expected: {formatAmountWithUnit(payment.amount_expected, getPaymentMethodLabel(payment.payment_method))}
                    {payment.amount_received
                      ? ` | Received: ${formatAmountWithUnit(payment.amount_received, getPaymentMethodLabel(payment.payment_method))}`
                      : ""}
                  </p>
                  {payment.amount_expected_fiat && payment.fiat_currency ? (
                    <p className="u-margin-b--none">
                      Checkout total: {formatAmountWithUnit(payment.amount_expected_fiat, payment.fiat_currency)}
                    </p>
                  ) : null}
                  {payment.conversion_rate ? (
                    <p className="u-margin-b--none">
                      Locked rate: {formatAmountWithUnit(payment.conversion_rate, "PHP")} / ETH
                    </p>
                  ) : null}
                  <p className="u-margin-b--none">Method: {getPaymentMethodLabel(payment.payment_method)}</p>
                  <p className="u-margin-b--none">Payer Wallet: {formatWalletAddress(payment.wallet_address)}</p>
                  <p className="u-margin-b--none">Recipient: {formatWalletAddress(payment.recipient_address)}</p>
                  <p className="u-margin-b--none">Tx Hash: {formatTransactionHash(payment.tx_hash)}</p>
                  <p className="u-margin-b--none" style={{ marginTop: "0.65rem", color: "#6c6c6c" }}>
                    {formatDateTime(payment.created_at)}
                  </p>
                  {payment.status === "pending" && getPaymentMethodConfig(payment.payment_method) ? (
                    <div style={{ marginTop: "1rem" }}>
                      <PaymentStatusButton
                        paymentId={payment.id}
                        paymentMethod={payment.payment_method}
                        amountExpected={payment.amount_expected}
                        recipientAddress={payment.recipient_address}
                        txHash={payment.tx_hash}
                      />
                    </div>
                  ) : payment.status === "pending" ? (
                    <div className="vh-status" style={{ marginTop: "1rem" }}>
                      This pending payment was created before the Sepolia wallet flow was enabled.
                    </div>
                  ) : null}
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
