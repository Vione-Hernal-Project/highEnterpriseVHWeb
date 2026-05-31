import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { requireAdminArea } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPaymentTone(status: string): "paid" | "pending" | "cancelled" {
  if (status === "paid") return "paid";
  if (status === "failed" || status === "cancelled") return "cancelled";
  return "pending";
}

export default async function AdminPaymentsPage() {
  await requireAdminArea("payments");

  let payments: Array<Record<string, any>> = [];
  let loadError = "";

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("payments").select("*").order("created_at", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      payments = data || [];
    }
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load payment records right now.");
  }

  const rows: AdminFilteredRow[] = payments.map((payment) => {
    const reference = payment.signature || payment.tx_hash;
    const tokenLabel = payment.token_type || getPaymentMethodLabel(payment.payment_method);
    const sender = payment.sender_wallet_address || payment.wallet_address;
    const tabKey = payment.status === "paid" ? "Confirmed" : payment.status === "failed" ? "Failed" : "Pending";

    return {
      id: payment.id,
      status: payment.status,
      tabKeys: [tabKey],
      date: payment.created_at,
      href: `/admin/ledger/transactions/payment/${payment.id}`,
      searchText: [payment.order_id, reference, sender, tokenLabel, getPaymentMethodLabel(payment.payment_method)].filter(Boolean).join(" "),
      sortText: payment.order_id || payment.id,
      facets: {
        chain: payment.chain_id ? `Chain ${payment.chain_id}` : payment.network || "Network pending",
        token: tokenLabel,
      },
      metrics: {
        confirmedFiatVolume: payment.status === "paid" ? toNumber(payment.amount_expected_fiat) : 0,
      },
      cells: [
        { kind: "text", text: payment.order_id || "No order link" },
        { kind: "text", text: getPaymentMethodLabel(payment.payment_method), subtext: payment.chain_id ? `Chain ${payment.chain_id}` : payment.network || "Network pending", strong: true },
        { kind: "text", text: formatAmountWithUnit(payment.amount_expected, tokenLabel) },
        { kind: "text", text: payment.amount_received ? formatAmountWithUnit(payment.amount_received, tokenLabel) : "Not confirmed" },
        { kind: "text", text: formatWalletAddress(sender) },
        { kind: "text", text: formatTransactionHash(reference) },
        { kind: "status", text: payment.status, tone: getPaymentTone(payment.status) },
        { kind: "text", text: formatDateTime(payment.created_at) },
        { kind: "link", href: `/admin/ledger/transactions/payment/${payment.id}`, text: "View", className: "vh-admin-view-button" },
      ],
    };
  });

  return (
    <AdminFilteredModule
      title="Payments"
      subtitle="Track blockchain payment records, wallet references, and chain confirmation state."
      includeMoreActions={false}
      alertMessage={loadError}
      stats={[
        { key: "confirmed-volume", label: "Confirmed Volume", valueKind: "sum", metricKey: "confirmedFiatVolume", statusTabs: ["Confirmed"], format: "currency", delta: "Paid records only", icon: "credit-card", activeTabs: ["Confirmed"] },
        { key: "confirmed-payments", label: "Confirmed Payments", valueKind: "count", statusTabs: ["Confirmed"], delta: "On-chain verified", tone: "green", icon: "check", activeTabs: ["Confirmed"] },
        { key: "pending-payments", label: "Pending Payments", valueKind: "count", statusTabs: ["Pending"], delta: "Awaiting confirmation", tone: "gold", icon: "clock", activeTabs: ["Pending"] },
        { key: "failed-payments", label: "Needs Attention", valueKind: "count", statusTabs: ["Failed"], delta: "Failed payment records", tone: "rose", icon: "alert", activeTabs: ["Failed"] },
      ]}
      tabs={["All Payments", "Confirmed", "Pending", "Failed"]}
      searchPlaceholder="Search wallet, order, tx hash..."
      filterConfigs={[
        { key: "chain", label: "Chain", allLabel: "All Chains" },
        { key: "token", label: "Token", allLabel: "All Tokens" },
      ]}
      columns={["Order", "Method", "Expected", "Received", "Wallet", "Tx / Signature", "Status", "Created", "Actions"]}
      rows={rows}
      emptyTitle="No payment records yet."
      emptyCopy="MetaMask and Phantom confirmations will appear here after checkout."
    />
  );
}
