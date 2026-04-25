import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelOrderSchema } from "@/lib/validations/order";

const ORDER_CANCEL_WINDOW_MS = 10 * 60_000;
const ORDER_CANCEL_USER_LIMIT = 20;
const ORDER_CANCEL_BODY_LIMIT_BYTES = 8 * 1024;

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const bodySizeError = getJsonBodySizeError(request, ORDER_CANCEL_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `orders:cancel:user:${user.id}`,
      limit: ORDER_CANCEL_USER_LIMIT,
      windowMs: ORDER_CANCEL_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many cancellation attempts were made for this account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = cancelOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order request." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.user_id !== user.id && !isManagementUser) {
      return NextResponse.json({ error: "You cannot cancel this order." }, { status: 403 });
    }

    if (order.status !== "pending") {
      return NextResponse.json({ error: "Only pending orders can be cancelled." }, { status: 400 });
    }

    const { data: relatedPayments, error: paymentsError } = await admin
      .from("payments")
      .select("id,status,tx_hash")
      .eq("order_id", order.id);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    const hasSubmittedPayment = (relatedPayments || []).some((payment) => payment.status === "paid" || Boolean(payment.tx_hash));

    if (hasSubmittedPayment) {
      return NextResponse.json(
        { error: "Orders with a submitted on-chain payment cannot be cancelled automatically. Contact support instead." },
        { status: 400 },
      );
    }

    const cancelledAt = new Date().toISOString();
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: cancelledAt,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (updateError || !updatedOrder) {
      return NextResponse.json({ error: updateError?.message || "Unable to cancel order." }, { status: 500 });
    }

    const { error: paymentError } = await admin
      .from("payments")
      .update({
        status: "cancelled",
      })
      .eq("order_id", order.id)
      .in("status", ["pending", "failed"]);

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to cancel the order right now.") }, { status: 500 });
  }
}
