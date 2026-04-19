import { NextResponse } from "next/server";

import { rebuildPaymentAllocations } from "@/lib/admin/payment-allocation-sync";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminOrderStatusSchema } from "@/lib/validations/order";

export async function GET() {
  try {
    const { user, canManageOrders } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!canManageOrders) {
      return NextResponse.json({ error: "Order operations access required." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("orders").select("*").order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load admin orders right now.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, canManageOrders, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!canManageOrders) {
      return NextResponse.json({ error: "Order operations access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = adminOrderStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order update request." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const [{ data: order, error: orderError }, { data: relatedPayments, error: paymentsError }] = await Promise.all([
      admin.from("orders").select("*").eq("id", parsed.data.orderId).maybeSingle(),
      admin.from("payments").select("*").eq("order_id", parsed.data.orderId),
    ]);

    if (orderError || paymentsError) {
      return NextResponse.json(
        { error: orderError?.message || paymentsError?.message || "Unable to load order." },
        { status: 500 },
      );
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const nextStatus = parsed.data.status;

    if (role === "staff" && order.status === "paid") {
      return NextResponse.json({ error: "Paid orders are view-only for staff." }, { status: 403 });
    }

    if (role === "staff" && nextStatus === "paid") {
      return NextResponse.json({ error: "Staff cannot mark orders as paid." }, { status: 403 });
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        status: nextStatus,
        cancelled_at: nextStatus === "cancelled" ? new Date().toISOString() : null,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (updateError || !updatedOrder) {
      return NextResponse.json({ error: updateError?.message || "Unable to update order." }, { status: 500 });
    }

    for (const payment of relatedPayments || []) {
      const paymentUpdate =
        nextStatus === "paid"
          ? { status: "paid", amount_received: payment.amount_received ?? payment.amount_expected }
          : nextStatus === "cancelled"
            ? { status: "cancelled", amount_received: payment.amount_received }
            : { status: "pending", amount_received: null };

      const { error } = await admin.from("payments").update(paymentUpdate).eq("id", payment.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await rebuildPaymentAllocations(payment.id);
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the order right now.") }, { status: 500 });
  }
}
