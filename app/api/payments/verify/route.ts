import { NextResponse } from "next/server";
import { getAddress, isAddress } from "ethers";

import { ensureConfirmedOnChainPaymentAllocations } from "@/lib/admin/payment-allocation-sync";
import { getCurrentUserContext } from "@/lib/auth";
import { getEthereumMainnetRpcEnvError, serverEnv } from "@/lib/env/server";
import type { Database } from "@/lib/database.types";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { logPaymentDebug } from "@/lib/payments/debug";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { verifyEthereumMainnetPayment } from "@/lib/payments/verify";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validations/order";
import { ETHEREUM_MAINNET_CHAIN_ID, isEthereumMainnetChain } from "@/lib/web3/network";

type OrderEmailRecord = {
  id: string;
  order_number: string | null;
  email: string | null;
  amount: string | number | null;
  status: string;
  confirmation_email_status: string;
  confirmation_email_sent_at: string | null;
};

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const PAYMENT_VERIFY_WINDOW_MS = 5 * 60_000;
const PAYMENT_VERIFY_IP_LIMIT = 60;
const PAYMENT_VERIFY_USER_LIMIT = 40;
const PAYMENT_VERIFY_PAYMENT_LIMIT = 24;
const PAYMENT_VERIFY_BODY_LIMIT_BYTES = 8 * 1024;

function getOrderConfirmationFunctionUrl() {
  const baseUrl = serverEnv.supabaseUrl.trim().replace(/\/+$/, "");

  return baseUrl ? `${baseUrl}/functions/v1/send-order-confirmation` : "";
}

function normalizeWalletAddress(address: string | null | undefined, fallbackMessage: string) {
  const value = (address || "").trim();

  if (!value || !isAddress(value)) {
    throw new Error(fallbackMessage);
  }

  return getAddress(value);
}

function resolveBoundWalletAddress(storedWalletAddress: string | null | undefined, requestedWalletAddress: string | null | undefined) {
  const normalizedStoredWallet = storedWalletAddress?.trim() ? normalizeWalletAddress(storedWalletAddress, "Saved payer wallet is invalid.") : null;
  const normalizedRequestedWallet = requestedWalletAddress?.trim()
    ? normalizeWalletAddress(requestedWalletAddress, "Submitted payer wallet is invalid.")
    : null;

  if (normalizedStoredWallet && normalizedRequestedWallet && normalizedStoredWallet !== normalizedRequestedWallet) {
    throw new Error("Reconnect the MetaMask wallet that was originally bound to this order before verifying the payment.");
  }

  return normalizedStoredWallet || normalizedRequestedWallet || null;
}

async function loadEarlierMatchingPendingPayment(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payment: PaymentRow,
  walletAddress: string,
  recipientAddress: string,
  chainId: number,
) {
  const { data, error } = await admin
    .from("payments")
    .select("id, created_at")
    .neq("id", payment.id)
    .eq("payment_method", payment.payment_method)
    .eq("wallet_address", walletAddress)
    .eq("recipient_address", recipientAddress)
    .eq("chain_id", chainId)
    .eq("amount_expected", payment.amount_expected)
    .in("status", ["pending", "failed"])
    .lt("created_at", payment.created_at)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to validate earlier matching payments.");
  }

  return data;
}

async function resolvePaymentBindingError(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  params: {
    payment: PaymentRow;
    order: OrderRow;
    walletAddress: string;
    recipientAddress: string;
    chainId: number;
    observedBlockAt: string;
  },
) {
  const orderCreatedAt = Date.parse(params.order.created_at || "");
  const observedBlockAt = Date.parse(params.observedBlockAt || "");

  if (!Number.isFinite(orderCreatedAt) || !Number.isFinite(observedBlockAt)) {
    return "Unable to confirm when this on-chain payment was mined for the order.";
  }

  if (observedBlockAt < orderCreatedAt) {
    return "This transaction was mined before the order was created, so it cannot be attached to this payment.";
  }

  const earlierMatchingPayment = await loadEarlierMatchingPendingPayment(
    admin,
    params.payment,
    params.walletAddress,
    params.recipientAddress,
    params.chainId,
  );

  if (earlierMatchingPayment?.id) {
    return "This transaction matches an earlier unresolved order from the same wallet and exact payment amount. Complete or cancel the earlier order before using this payment.";
  }

  return null;
}

async function sendPaidOrderConfirmationEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  order: OrderEmailRecord,
  paymentId: string,
) {
  if (order.status !== "paid") {
    return order;
  }

  if (order.confirmation_email_status === "sent" || order.confirmation_email_sent_at) {
    logPaymentDebug("order-confirmation-skip", {
      orderId: order.id,
      paymentId,
      reason: "already_sent",
      confirmationEmailStatus: order.confirmation_email_status,
    });

    return order;
  }

  if (!order.email) {
    logPaymentDebug("order-confirmation-failed", {
      orderId: order.id,
      paymentId,
      reason: "missing_customer_email",
    });

    const { data: failedOrder } = await admin
      .from("orders")
      .update({
        confirmation_email_status: "failed",
      })
      .eq("id", order.id)
      .select("*")
      .single();

    return (failedOrder as OrderEmailRecord | null) ?? { ...order, confirmation_email_status: "failed" };
  }

  try {
    const total = typeof order.amount === "string" ? Number(order.amount) : order.amount;
    const orderConfirmationFunctionUrl = getOrderConfirmationFunctionUrl();

    if (!orderConfirmationFunctionUrl || !serverEnv.supabaseAnonKey) {
      throw new Error("Supabase order confirmation function is not configured.");
    }

    const response = await fetch(orderConfirmationFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serverEnv.supabaseAnonKey,
        Authorization: `Bearer ${serverEnv.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        customerEmail: order.email,
        orderNumber: order.order_number || order.id,
        total: Number.isFinite(total) ? total : 0,
      }),
    });

    const rawBody = await response.text().catch(() => "");
    let parsedBody: { statusCode?: number; name?: string; message?: string } | null = null;

    try {
      parsedBody = rawBody ? (JSON.parse(rawBody) as { statusCode?: number; name?: string; message?: string }) : null;
    } catch {
      parsedBody = null;
    }

    if (!response.ok || (parsedBody?.statusCode && parsedBody.statusCode >= 400)) {
      throw new Error(
        parsedBody?.message ||
          `Edge Function returned ${response.status}${rawBody ? `: ${rawBody.slice(0, 240)}` : ""}`,
      );
    }

    const sentAt = new Date().toISOString();
    const { data: sentOrder } = await admin
      .from("orders")
      .update({
        confirmation_email_status: "sent",
        confirmation_email_sent_at: sentAt,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    logPaymentDebug("order-confirmation-sent", {
      orderId: order.id,
      paymentId,
      customerEmail: order.email,
      orderNumber: order.order_number || order.id,
    });

    return (sentOrder as OrderEmailRecord | null) ?? {
      ...order,
      confirmation_email_status: "sent",
      confirmation_email_sent_at: sentAt,
    };
  } catch (error) {
    const message = getErrorMessage(error, "Unable to send the paid order confirmation email.");

    logPaymentDebug("order-confirmation-failed", {
      orderId: order.id,
      paymentId,
      error: message,
    });

    const { data: failedOrder } = await admin
      .from("orders")
      .update({
        confirmation_email_status: "failed",
      })
      .eq("id", order.id)
      .select("*")
      .single();

    return (failedOrder as OrderEmailRecord | null) ?? { ...order, confirmation_email_status: "failed" };
  }
}

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const bodySizeError = getJsonBodySizeError(request, PAYMENT_VERIFY_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = verifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment verification request." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const ipRateLimit = await applyRateLimit({
      key: `payments:verify:ip:${ipAddress}`,
      limit: PAYMENT_VERIFY_IP_LIMIT,
      windowMs: PAYMENT_VERIFY_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many payment verification checks were made from this connection. Please wait a moment and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const userRateLimit = await applyRateLimit({
      key: `payments:verify:user:${user.id}`,
      limit: PAYMENT_VERIFY_USER_LIMIT,
      windowMs: PAYMENT_VERIFY_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many payment verification checks were made for this account. Please wait a moment and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const paymentRateLimit = await applyRateLimit({
      key: `payments:verify:payment:${parsed.data.paymentId}`,
      limit: PAYMENT_VERIFY_PAYMENT_LIMIT,
      windowMs: PAYMENT_VERIFY_WINDOW_MS,
    });

    if (!paymentRateLimit.allowed) {
      return NextResponse.json(
        { error: "This payment has been checked too many times in a short window. Please wait a moment before retrying." },
        {
          status: 429,
          headers: buildRateLimitHeaders(paymentRateLimit.resetAt),
        },
      );
    }

    const rpcSetupError = getEthereumMainnetRpcEnvError();

    if (rpcSetupError) {
      return NextResponse.json({ error: rpcSetupError }, { status: 400 });
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
      if (!payment.order_id) {
        return NextResponse.json({ error: "Payment is not attached to an order." }, { status: 400 });
      }

      const { data: existingOrder, error: existingOrderError } = await admin
        .from("orders")
        .select("*")
        .eq("id", payment.order_id)
        .maybeSingle();

      if (existingOrderError) {
        return NextResponse.json({ error: existingOrderError.message }, { status: 500 });
      }

      if (existingOrder) {
        await sendPaidOrderConfirmationEmail(admin, existingOrder as OrderEmailRecord, payment.id);
      }

      await ensureConfirmedOnChainPaymentAllocations(payment.id);

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
    const walletAddress = resolveBoundWalletAddress(payment.wallet_address, parsed.data.walletAddress);
    const merchantWallet = await resolveMerchantWalletAddress();
    const recipientAddress = payment.recipient_address || merchantWallet.address;
    const chainId = payment.chain_id || ETHEREUM_MAINNET_CHAIN_ID;

    if (!txHash) {
      return NextResponse.json({ error: "No transaction hash was submitted for this payment yet." }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json(
        {
          error:
            "This payment does not have a bound payer wallet. Cancel the order and create a new payment from the wallet you plan to use.",
        },
        { status: 400 },
      );
    }

    if (payment.tx_hash && parsed.data.txHash && payment.tx_hash !== parsed.data.txHash && payment.status !== "failed") {
      return NextResponse.json(
        {
          error:
            "This payment already has a submitted transaction hash. Wait for that transaction to resolve before trying a different one.",
        },
        { status: 409 },
      );
    }

    if (!isEthereumMainnetChain(chainId)) {
      return NextResponse.json(
        {
          error: `This payment is configured for chain ID ${chainId}, but only Ethereum Mainnet (${ETHEREUM_MAINNET_CHAIN_ID}) is supported.`,
        },
        { status: 400 },
      );
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

    const { data: duplicatePayment, error: duplicatePaymentError } = await admin
      .from("payments")
      .select("id")
      .neq("id", payment.id)
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (duplicatePaymentError) {
      return NextResponse.json({ error: duplicatePaymentError.message || "Unable to validate this transaction hash." }, { status: 500 });
    }

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

    const { error: bindPaymentError } = await admin
      .from("payments")
      .update({
        tx_hash: txHash,
        wallet_address: walletAddress,
        recipient_address: recipientAddress,
        chain_id: chainId,
      })
      .eq("id", payment.id);

    if (bindPaymentError) {
      return NextResponse.json({ error: bindPaymentError.message || "Unable to bind the payment wallet." }, { status: 500 });
    }

    const verification = await verifyEthereumMainnetPayment({
      payment: {
        ...payment,
        tx_hash: txHash,
        wallet_address: walletAddress,
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
          status: "failed",
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
            status: "failed",
          },
        },
        { status: 400 },
      );
    }

    const bindingError = await resolvePaymentBindingError(admin, {
      payment,
      order,
      walletAddress: verification.walletAddress,
      recipientAddress,
      chainId,
      observedBlockAt: verification.observedBlockAt,
    });

    if (bindingError) {
      const { data: updatedPayment } = await admin
        .from("payments")
        .update({
          tx_hash: verification.txHash,
          wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          status: "failed",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      return NextResponse.json(
        {
          verificationStatus: "invalid",
          error: bindingError,
          payment: updatedPayment ?? {
            ...payment,
            tx_hash: verification.txHash,
            wallet_address: verification.walletAddress,
            status: "failed",
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

    const orderWithConfirmation = await sendPaidOrderConfirmationEmail(
      admin,
      updatedOrder as OrderEmailRecord,
      updatedPayment.id,
    );

    await ensureConfirmedOnChainPaymentAllocations(updatedPayment.id);

    return NextResponse.json({
      verificationStatus: "paid",
      message: verification.message,
      payment: updatedPayment,
      order: orderWithConfirmation,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to verify this payment right now.") }, { status: 500 });
  }
}
