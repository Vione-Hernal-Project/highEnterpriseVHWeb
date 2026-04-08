import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mockPaymentSchema } from "@/lib/validations/order";

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = mockPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment request." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentLoadError } = await admin
      .from("payments")
      .select("*")
      .eq("id", parsed.data.paymentId)
      .maybeSingle();

    if (paymentLoadError) {
      return NextResponse.json({ error: paymentLoadError.message || "Unable to load payment." }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (!payment.order_id) {
      return NextResponse.json({ error: "Payment is not attached to an order." }, { status: 400 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ error: "This payment is already finalized." }, { status: 400 });
    }

    const isOrderOwner = payment.user_id === user.id;

    if (!isOrderOwner && !isManagementUser) {
      return NextResponse.json({ error: "You cannot update this payment." }, { status: 403 });
    }

    const { data: relatedOrder, error: orderLoadError } = await admin
      .from("orders")
      .select("*")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderLoadError) {
      return NextResponse.json({ error: orderLoadError.message || "Unable to load order." }, { status: 500 });
    }

    if (relatedOrder?.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled orders cannot be marked as paid." }, { status: 400 });
    }

    const { data: updatedPayment, error: paymentError } = await admin
      .from("payments")
      .update({
        status: "paid",
        amount_received: payment.amount_expected,
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (paymentError || !updatedPayment) {
      return NextResponse.json({ error: paymentError?.message || "Unable to update payment." }, { status: 500 });
    }

    const { error: orderError } = await admin
      .from("orders")
      .update({
        status: "paid",
      })
      .eq("id", payment.order_id);

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({ payment: updatedPayment });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the mock payment right now.") }, { status: 500 });
  }
}
