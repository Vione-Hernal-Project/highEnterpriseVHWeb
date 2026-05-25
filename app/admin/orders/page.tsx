import { AdminOrdersView, type AdminOrderViewRow } from "@/components/admin/admin-orders-view";
import { requireOrderOperationsUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { buildOrderItemsByOrderId, getOrderDisplayLines } from "@/lib/order-items";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatTransactionHash } from "@/lib/utils";

function getCustomerName(order: Record<string, any>) {
  return order.customer_name || order.email || "Guest customer";
}

function getPaymentForOrder(payments: Array<Record<string, any>>, order: Record<string, any>) {
  return payments.find((payment) => payment.order_id === order.id || payment.order_id === order.order_number) || null;
}

export default async function AdminOrdersPage() {
  const { role, isManagementUser } = await requireOrderOperationsUser();
  let orders: Array<Record<string, any>> = [];
  let payments: Array<Record<string, any>> = [];
  let orderItems: Array<Record<string, any>> = [];
  let loadError = "";

  try {
    const admin = createSupabaseAdminClient();
    const [ordersResult, orderItemsResult, paymentsResult] = await Promise.all([
      admin.from("orders").select("*").order("created_at", { ascending: false }),
      admin.from("order_items").select("*").order("created_at", { ascending: true }),
      admin.from("payments").select("*").order("created_at", { ascending: false }),
    ]);

    if (ordersResult.error || orderItemsResult.error || paymentsResult.error) {
      loadError = ordersResult.error?.message || orderItemsResult.error?.message || paymentsResult.error?.message || "";
    } else {
      orders = ordersResult.data || [];
      orderItems = orderItemsResult.data || [];
      payments = paymentsResult.data || [];
    }
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load order operations right now.");
  }

  const orderItemsByOrderId = buildOrderItemsByOrderId(orderItems as any);
  const rows: AdminOrderViewRow[] = orders.map((order) => {
    const payment = getPaymentForOrder(payments, order);
    const orderLines = getOrderDisplayLines(order as any, (orderItemsByOrderId.get(order.id) || []) as any);
    const tokenLabel = payment?.token_type || getPaymentMethodLabel(payment?.payment_method);
    const transactionRef = payment?.signature || payment?.tx_hash;

    return {
      id: order.id,
      orderNumber: order.order_number || order.id,
      customerName: getCustomerName(order),
      customerEmail: order.email || "No email recorded",
      createdAt: order.created_at,
      dateLabel: formatDateTime(order.created_at),
      amountLabel: formatAmountWithUnit(order.amount, order.currency),
      status: order.status,
      initialStatus: order.status,
      itemCount: orderLines.length || order.quantity || 1,
      detailHref: `/admin/orders/${order.id}`,
      paymentMethodLabel: payment ? getPaymentMethodLabel(payment.payment_method) : "No payment record",
      tokenLabel: payment ? tokenLabel : "",
      transactionLabel: payment ? formatTransactionHash(transactionRef) : "",
      paymentDetailHref: payment ? `/admin/ledger/transactions/payment/${payment.id}` : null,
    };
  });

  return (
    <AdminOrdersView
      rows={rows}
      role={role}
      isManagementUser={isManagementUser}
      loadError={loadError}
    />
  );
}
