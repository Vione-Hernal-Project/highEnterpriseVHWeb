import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { ProfileRoleForm } from "@/components/admin/profile-role-form";
import { requireManagementUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";

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
          payment records, adjust order status when needed, and manage admin access.
        </p>
        {adminError ? <div className="vh-status vh-status--error">{adminError}</div> : null}
        <div className="vh-actions">
          <Link className="vh-button vh-button--ghost" href="/dashboard">
            Back To Dashboard
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="vh-admin-columns" style={{ marginTop: "2rem" }}>
        <section className="vh-data-card">
          <h2 className="h3 u-margin-b--lg">All Orders</h2>
          <div className="vh-list">
            {orders?.length ? (
              orders.map((order) => (
                <article key={order.id} className="vh-history-item">
                  <strong>{order.order_number || order.id}</strong>
                  <p className="u-margin-b--none">{order.email || "No email recorded"}</p>
                  {order.product_name ? (
                    <p className="u-margin-b--none">
                      {order.product_name}
                      {order.quantity ? ` · Qty ${order.quantity}` : ""}
                    </p>
                  ) : null}
                  <p className="u-margin-b--none">{order.customer_name}</p>
                  <p className="u-margin-b--none">{order.phone}</p>
                  <p className="u-margin-b--none">{order.shipping_address}</p>
                  <p className="u-margin-b--none">{formatAmountWithUnit(order.amount, order.currency)}</p>
                  <p className="u-margin-b--none">Status: {order.status}</p>
                  <p className="u-margin-b--none">Confirmation Email: {order.confirmation_email_status}</p>
                  <p className="u-margin-b--none" style={{ color: "#6c6c6c" }}>
                    {formatDateTime(order.created_at)}
                  </p>
                  <AdminOrderStatusForm orderId={order.id} initialStatus={order.status} />
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
              payments.map((payment) => (
                <article key={payment.id} className="vh-history-item">
                  <strong>{payment.id}</strong>
                  <p className="u-margin-b--none">Order: {payment.order_id}</p>
                  <p className="u-margin-b--none">
                    Expected: {formatAmountWithUnit(payment.amount_expected, getPaymentMethodLabel(payment.payment_method))}
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
                  {payment.amount_received ? (
                    <p className="u-margin-b--none">
                      Received: {formatAmountWithUnit(payment.amount_received, getPaymentMethodLabel(payment.payment_method))}
                    </p>
                  ) : null}
                  <p className="u-margin-b--none">Method: {getPaymentMethodLabel(payment.payment_method)}</p>
                  <p className="u-margin-b--none">Payer Wallet: {formatWalletAddress(payment.wallet_address)}</p>
                  <p className="u-margin-b--none">Recipient: {formatWalletAddress(payment.recipient_address)}</p>
                  <p className="u-margin-b--none">Tx Hash: {formatTransactionHash(payment.tx_hash)}</p>
                  <p className="u-margin-b--none">Status: {payment.status}</p>
                  <p className="u-margin-b--none" style={{ color: "#6c6c6c" }}>
                    {formatDateTime(payment.created_at)}
                  </p>
                </article>
              ))
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
