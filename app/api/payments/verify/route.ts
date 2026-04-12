import { NextResponse } from "next/server";

import { rebuildPaymentAllocations } from "@/lib/admin/payment-allocation-sync";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { logPaymentDebug } from "@/lib/payments/debug";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { verifySepoliaPayment } from "@/lib/payments/verify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validations/order";
import { SEPOLIA_CHAIN_ID } from "@/lib/web3/config";

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = verifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment verification request." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("*")
      .eq("id", parsed.data.paymentId)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.user_id !== user.id && !isManagementUser) {
      return NextResponse.json({ error: "You cannot verify this payment." }, { status: 403 });
    }

    if (payment.status === "paid") {
      return NextResponse.json({
        verificationStatus: "paid",
        message: "This payment is already confirmed.",
        payment,
      });
    }

    if (!payment.order_id) {
      return NextResponse.json({ error: "Payment is not attached to an order." }, { status: 400 });
    }

    const txHash = parsed.data.txHash || payment.tx_hash;
    const walletAddress = parsed.data.walletAddress || payment.wallet_address;
    const merchantWallet = await resolveMerchantWalletAddress();
    const recipientAddress = payment.recipient_address || merchantWallet.address;
    const chainId = payment.chain_id || SEPOLIA_CHAIN_ID;

    if (!txHash) {
      return NextResponse.json({ error: "No transaction hash was submitted for this payment yet." }, { status: 400 });
    }

    logPaymentDebug("verify-request", {
      paymentId: payment.id,
      orderId: payment.order_id,
      connectedWalletAddress: walletAddress ?? null,
      recipientAddress,
      txHash,
      chainId,
      amountExpected: payment.amount_expected,
      paymentMethod: payment.payment_method,
    });

    const { data: duplicatePayment } = await admin
      .from("payments")
      .select("id")
      .neq("id", payment.id)
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (duplicatePayment) {
      return NextResponse.json({ error: "This transaction hash is already attached to another payment." }, { status: 409 });
    }

    const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", payment.order_id).maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled orders cannot be paid." }, { status: 400 });
    }

    await admin
      .from("payments")
      .update({
        tx_hash: txHash,
        wallet_address: walletAddress ?? null,
        recipient_address: recipientAddress,
        chain_id: chainId,
      })
      .eq("id", payment.id);

    const verification = await verifySepoliaPayment({
      payment: {
        ...payment,
        tx_hash: txHash,
        wallet_address: walletAddress ?? payment.wallet_address,
        recipient_address: recipientAddress,
        chain_id: chainId,
      },
      txHash,
      walletAddress,
      expectedRecipientAddress: recipientAddress,
      expectedChainId: chainId,
    });

    if (verification.status === "pending") {
      const { data: updatedPayment } = await admin
        .from("payments")
        .update({
          tx_hash: verification.txHash,
          wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          status: "pending",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      return NextResponse.json(
        {
          verificationStatus: "pending",
          message: verification.message,
          payment: updatedPayment ?? {
            ...payment,
            tx_hash: verification.txHash,
            wallet_address: verification.walletAddress,
          },
        },
        { status: 202 },
      );
    }

    if (verification.status === "invalid") {
      const { data: updatedPayment } = await admin
        .from("payments")
        .update({
          tx_hash: verification.txHash,
          wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          status: "pending",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      return NextResponse.json(
        {
          verificationStatus: "invalid",
          error: verification.message,
          payment: updatedPayment ?? {
            ...payment,
            tx_hash: verification.txHash,
            wallet_address: verification.walletAddress,
          },
        },
        { status: 400 },
      );
    }

    const { data: updatedPayment, error: updatePaymentError } = await admin
      .from("payments")
      .update({
        tx_hash: verification.txHash,
        wallet_address: verification.walletAddress,
        recipient_address: recipientAddress,
        chain_id: chainId,
        amount_received: verification.amountReceived,
        status: "paid",
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (updatePaymentError || !updatedPayment) {
      return NextResponse.json({ error: updatePaymentError?.message || "Unable to update payment." }, { status: 500 });
    }

    const { data: updatedOrder, error: updateOrderError } = await admin
      .from("orders")
      .update({
        status: "paid",
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (updateOrderError || !updatedOrder) {
      return NextResponse.json({ error: updateOrderError?.message || "Unable to update order." }, { status: 500 });
    }

    await rebuildPaymentAllocations(updatedPayment.id);

    return NextResponse.json({
      verificationStatus: "paid",
      message: verification.message,
      payment: updatedPayment,
      order: updatedOrder,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to verify this payment right now.") }, { status: 500 });
  }
}
