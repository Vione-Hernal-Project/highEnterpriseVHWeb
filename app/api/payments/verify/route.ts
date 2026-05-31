import { NextResponse } from "next/server";
import { getAddress, isAddress } from "ethers";

import { isPaymentPendingTooLong, tryDispatchAdminNotification } from "@/lib/admin/notifications";
import { ensureConfirmedOnChainPaymentAllocations } from "@/lib/admin/payment-allocation-sync";
import { getCurrentUserContext } from "@/lib/auth";
import {
  assertCouponCanBeRedeemedForOrder,
  isMissingCouponsTableError,
  recordPaidCouponRedemptionForOrder,
} from "@/lib/coupons";
import { getEthereumMainnetRpcEnvError, getSolanaRpcEnvError, serverEnv } from "@/lib/env/server";
import type { Database } from "@/lib/database.types";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig } from "@/lib/payments/options";
import { verifyEthereumMainnetPayment } from "@/lib/payments/verify";
import { verifySolanaPayment } from "@/lib/payments/verify-solana";
import { normalizeSolanaAddress } from "@/lib/solana/network";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validations/order";
import { ETHEREUM_MAINNET_CHAIN_ID, isEthereumMainnetChain, SOLANA_MAINNET_CHAIN_ID } from "@/lib/web3/network";

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
type FinalizedPaymentPayload = {
  payment?: PaymentRow;
  order?: OrderRow;
};

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

function resolveBoundPaymentWalletAddress(
  paymentMethod: string,
  storedWalletAddress: string | null | undefined,
  requestedWalletAddress: string | null | undefined,
) {
  const paymentConfig = getPaymentMethodConfig(paymentMethod);

  if (paymentConfig?.network === "solana") {
    const normalizedStoredWallet = storedWalletAddress?.trim()
      ? normalizeSolanaAddress(storedWalletAddress, "Saved Solana payer wallet is invalid.")
      : null;
    const normalizedRequestedWallet = requestedWalletAddress?.trim()
      ? normalizeSolanaAddress(requestedWalletAddress, "Submitted Solana payer wallet is invalid.")
      : null;

    if (normalizedStoredWallet && normalizedRequestedWallet && normalizedStoredWallet !== normalizedRequestedWallet) {
      throw new Error("Reconnect the Solana wallet that was originally bound to this order before verifying the payment.");
    }

    return normalizedStoredWallet || normalizedRequestedWallet || null;
  }

  return resolveBoundWalletAddress(storedWalletAddress, requestedWalletAddress);
}

function isEvmTransactionHash(value: string) {
  return /^0x([A-Fa-f0-9]{64})$/.test(value.trim());
}

function isSolanaSignature(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.trim());
}

function normalizePaymentTxHash(value: string, isSolanaPayment: boolean) {
  const trimmed = value.trim();

  return isSolanaPayment ? trimmed : trimmed.toLowerCase();
}

function resolvePaymentFinalizationStatus(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("payment id is invalid") ||
    normalizedMessage.includes("transaction hash is invalid") ||
    normalizedMessage.includes("wallet address is invalid") ||
    normalizedMessage.includes("recipient address is invalid") ||
    normalizedMessage.includes("chain id is invalid") ||
    normalizedMessage.includes("received amount is invalid") ||
    normalizedMessage.includes("payment is not attached") ||
    normalizedMessage.includes("cancelled orders cannot be paid")
  ) {
    return 400;
  }

  if (normalizedMessage.includes("payment not found") || normalizedMessage.includes("order not found")) {
    return 404;
  }

  if (normalizedMessage.includes("already attached to another payment") || normalizedMessage.includes("duplicate key")) {
    return 409;
  }

  return 500;
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

      await tryDispatchAdminNotification("payment.confirmed", {
        entityId: payment.id,
        title: `Payment already confirmed ${payment.id}`,
        message: `A paid payment record was reviewed for order ${existingOrder?.order_number || payment.order_id}.`,
        href: payment.order_id ? `/admin/orders/${payment.order_id}` : "/admin/payments",
        amount: payment.amount_expected_fiat,
        metadata: {
          paymentId: payment.id,
          orderId: payment.order_id,
          paymentMethod: payment.payment_method,
        },
      });

      return NextResponse.json({
        verificationStatus: "paid",
        message: "This payment is already confirmed.",
        payment,
      });
    }

    if (!payment.order_id) {
      return NextResponse.json({ error: "Payment is not attached to an order." }, { status: 400 });
    }

    const paymentConfig = getPaymentMethodConfig(payment.payment_method);

    if (!paymentConfig) {
      return NextResponse.json({ error: "Unsupported token for this chain." }, { status: 400 });
    }

    const isSolanaPayment = paymentConfig.network === "solana";
    const expectedNetwork = isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet";

    if (payment.payment_type !== payment.payment_method) {
      return NextResponse.json({ error: "Payment type does not match this payment record." }, { status: 400 });
    }

    if (payment.wallet_provider !== paymentConfig.walletProvider) {
      return NextResponse.json({ error: "Payment wallet provider does not match this payment type." }, { status: 400 });
    }

    if (payment.token_type !== paymentConfig.tokenType) {
      return NextResponse.json({ error: "Unsupported token for this chain." }, { status: 400 });
    }

    if (payment.network !== expectedNetwork) {
      return NextResponse.json(
        {
          error: isSolanaPayment
            ? "Wrong network selected. Please switch to Solana mainnet."
            : "Wrong network selected. Please switch to Ethereum mainnet.",
        },
        { status: 400 },
      );
    }

    if (payment.token_standard !== paymentConfig.tokenStandard) {
      return NextResponse.json({ error: "Unsupported token for this chain." }, { status: 400 });
    }

    const rpcSetupError = isSolanaPayment ? getSolanaRpcEnvError() : getEthereumMainnetRpcEnvError();

    if (rpcSetupError) {
      return NextResponse.json({ error: rpcSetupError }, { status: 400 });
    }

    const rawTxHash = parsed.data.txHash || payment.tx_hash;
    const txHash = rawTxHash ? normalizePaymentTxHash(rawTxHash, isSolanaPayment) : "";
    const storedTxHash = payment.tx_hash ? normalizePaymentTxHash(payment.tx_hash, isSolanaPayment) : "";
    const requestedTxHash = parsed.data.txHash ? normalizePaymentTxHash(parsed.data.txHash, isSolanaPayment) : "";
    const walletAddress = resolveBoundPaymentWalletAddress(payment.payment_method, payment.wallet_address, parsed.data.walletAddress);

    if (!payment.recipient_address?.trim()) {
      return NextResponse.json(
        { error: "This payment is missing its saved recipient wallet address. Cancel the order and create a new payment." },
        { status: 400 },
      );
    }

    let recipientAddress: string;

    try {
      recipientAddress = isSolanaPayment
        ? normalizeSolanaAddress(payment.recipient_address, "Saved Solana recipient wallet is invalid.")
        : normalizeWalletAddress(payment.recipient_address, "Saved merchant recipient wallet is invalid.");
    } catch (recipientError) {
      return NextResponse.json({ error: getErrorMessage(recipientError, "Saved recipient wallet is invalid.") }, { status: 400 });
    }

    if (payment.chain_id === null || payment.chain_id === undefined) {
      return NextResponse.json(
        { error: "This payment is missing its saved chain ID. Cancel the order and create a new payment." },
        { status: 400 },
      );
    }

    const chainId = Number(payment.chain_id);

    if (!Number.isFinite(chainId) || chainId <= 0) {
      return NextResponse.json({ error: "Saved payment chain ID is invalid." }, { status: 400 });
    }

    if (!txHash) {
      return NextResponse.json({ error: "No transaction hash was submitted for this payment yet." }, { status: 400 });
    }

    if (isSolanaPayment && !isSolanaSignature(txHash)) {
      return NextResponse.json({ error: "Solana payments require a valid Solana transaction signature." }, { status: 400 });
    }

    if (!isSolanaPayment && !isEvmTransactionHash(txHash)) {
      return NextResponse.json({ error: "Ethereum payments require a valid EVM transaction hash." }, { status: 400 });
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

    if (storedTxHash && requestedTxHash && storedTxHash !== requestedTxHash && payment.status !== "failed") {
      return NextResponse.json(
        {
          error:
            "This payment already has a submitted transaction hash. Wait for that transaction to resolve before trying a different one.",
        },
        { status: 409 },
      );
    }

    if (!isSolanaPayment && !isEthereumMainnetChain(chainId)) {
      return NextResponse.json(
        {
          error: "Wrong network selected. Please switch to Ethereum mainnet.",
        },
        { status: 400 },
      );
    }

    if (isSolanaPayment && Number(chainId) !== SOLANA_MAINNET_CHAIN_ID) {
      return NextResponse.json(
        {
          error: "Wrong network selected. Please switch to Solana mainnet.",
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

    const duplicatePaymentQuery = admin
      .from("payments")
      .select("id")
      .neq("id", payment.id);
    const { data: duplicatePayment, error: duplicatePaymentError } = await (isSolanaPayment
      ? duplicatePaymentQuery.eq("tx_hash", txHash)
      : duplicatePaymentQuery.ilike("tx_hash", txHash)
    ).maybeSingle();

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
        signature: isSolanaPayment ? txHash : null,
        wallet_address: walletAddress,
        sender_wallet_address: walletAddress,
        recipient_address: recipientAddress,
        chain_id: chainId,
        payment_type: payment.payment_method,
        wallet_provider: paymentConfig.walletProvider,
        network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
        token_type: paymentConfig.tokenType,
        token_standard: paymentConfig.tokenStandard,
      })
      .eq("id", payment.id);

    if (bindPaymentError) {
      return NextResponse.json({ error: bindPaymentError.message || "Unable to bind the payment wallet." }, { status: 500 });
    }

    const paymentForVerification = {
      ...payment,
      tx_hash: txHash,
      signature: isSolanaPayment ? txHash : null,
      wallet_address: walletAddress,
      sender_wallet_address: walletAddress,
      recipient_address: recipientAddress,
      chain_id: chainId,
      payment_type: payment.payment_method,
      wallet_provider: paymentConfig.walletProvider,
      network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
      token_type: paymentConfig.tokenType,
      token_standard: paymentConfig.tokenStandard,
    };
    const verification = isSolanaPayment
      ? await verifySolanaPayment({
          payment: paymentForVerification,
          txHash,
          walletAddress,
          expectedRecipientAddress: recipientAddress,
        })
      : await verifyEthereumMainnetPayment({
          payment: paymentForVerification,
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
          signature: isSolanaPayment ? verification.txHash : null,
          wallet_address: verification.walletAddress,
          sender_wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          payment_type: payment.payment_method,
          wallet_provider: paymentConfig.walletProvider,
          network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
          token_type: paymentConfig.tokenType,
          token_standard: paymentConfig.tokenStandard,
          status: "pending",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      if (isPaymentPendingTooLong(payment.created_at)) {
        await tryDispatchAdminNotification("payment.pending_too_long", {
          entityId: payment.id,
          title: `Payment pending too long ${payment.id}`,
          message: `Payment for order ${order.order_number || order.id} is still waiting for confirmation.`,
          href: `/admin/orders/${order.id}`,
          amount: payment.amount_expected_fiat,
          metadata: {
            paymentId: payment.id,
            orderId: order.id,
            orderNumber: order.order_number,
            paymentMethod: payment.payment_method,
          },
        });
      }

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
          signature: isSolanaPayment ? verification.txHash : null,
          wallet_address: verification.walletAddress,
          sender_wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          payment_type: payment.payment_method,
          wallet_provider: paymentConfig.walletProvider,
          network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
          token_type: paymentConfig.tokenType,
          token_standard: paymentConfig.tokenStandard,
          status: "failed",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      await tryDispatchAdminNotification("payment.failed", {
        entityId: payment.id,
        title: `Payment failed ${payment.id}`,
        message: verification.message,
        href: `/admin/orders/${order.id}`,
        amount: payment.amount_expected_fiat,
        metadata: {
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.order_number,
          paymentMethod: payment.payment_method,
          reason: verification.message,
        },
      });

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

    if (payment.quote_expires_at && Date.parse(verification.observedBlockAt) > Date.parse(payment.quote_expires_at)) {
      const { data: updatedPayment } = await admin
        .from("payments")
        .update({
          tx_hash: verification.txHash,
          signature: isSolanaPayment ? verification.txHash : null,
          wallet_address: verification.walletAddress,
          sender_wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          payment_type: payment.payment_method,
          wallet_provider: paymentConfig.walletProvider,
          network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
          token_type: paymentConfig.tokenType,
          token_standard: paymentConfig.tokenStandard,
          status: "failed",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      await tryDispatchAdminNotification("payment.failed", {
        entityId: payment.id,
        title: `Payment failed ${payment.id}`,
        message: `Payment for order ${order.order_number || order.id} confirmed after the locked quote expired.`,
        href: `/admin/orders/${order.id}`,
        amount: payment.amount_expected_fiat,
        metadata: {
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.order_number,
          paymentMethod: payment.payment_method,
          reason: "quote_expired",
        },
      });

      return NextResponse.json(
        {
          verificationStatus: "invalid",
          error: "This payment was confirmed after the locked quote expired. Refresh the quote and create a new payment.",
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
          signature: isSolanaPayment ? verification.txHash : null,
          wallet_address: verification.walletAddress,
          sender_wallet_address: verification.walletAddress,
          recipient_address: recipientAddress,
          chain_id: chainId,
          payment_type: payment.payment_method,
          wallet_provider: paymentConfig.walletProvider,
          network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
          token_type: paymentConfig.tokenType,
          token_standard: paymentConfig.tokenStandard,
          status: "failed",
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      await tryDispatchAdminNotification("payment.failed", {
        entityId: payment.id,
        title: `Payment failed ${payment.id}`,
        message: bindingError,
        href: `/admin/orders/${order.id}`,
        amount: payment.amount_expected_fiat,
        metadata: {
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.order_number,
          paymentMethod: payment.payment_method,
          reason: bindingError,
        },
      });

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

    try {
      await assertCouponCanBeRedeemedForOrder(admin, order);
    } catch (couponError) {
      return NextResponse.json(
        { error: getErrorMessage(couponError, "This coupon can no longer be redeemed for this order.") },
        { status: 409 },
      );
    }

    const { data: finalizedPaymentData, error: finalizePaymentError } = await admin.rpc("finalize_verified_payment", {
      p_payment_id: payment.id,
      p_tx_hash: verification.txHash,
      p_wallet_address: verification.walletAddress,
      p_recipient_address: recipientAddress,
      p_chain_id: chainId,
      p_amount_received: verification.amountReceived,
    });

    if (finalizePaymentError) {
      return NextResponse.json(
        { error: finalizePaymentError.message || "Unable to finalize this payment." },
        { status: resolvePaymentFinalizationStatus(finalizePaymentError.message || "") },
      );
    }

    const finalizedPaymentPayload = finalizedPaymentData as FinalizedPaymentPayload | null;
    const updatedPayment = finalizedPaymentPayload?.payment;
    const updatedOrder = finalizedPaymentPayload?.order;

    if (!updatedPayment || !updatedOrder) {
      return NextResponse.json({ error: "Payment finalization did not return the updated records." }, { status: 500 });
    }

    const orderWithConfirmation = await sendPaidOrderConfirmationEmail(
      admin,
      updatedOrder as OrderEmailRecord,
      updatedPayment.id,
    );

    try {
      await recordPaidCouponRedemptionForOrder(admin, {
        order: updatedOrder,
        paymentId: updatedPayment.id,
      });
    } catch (couponRedemptionError) {
      if (!isMissingCouponsTableError(couponRedemptionError)) {
        console.warn("Unable to write coupon redemption history after payment confirmation.", {
          orderId: updatedOrder.id,
          paymentId: updatedPayment.id,
          error: getErrorMessage(couponRedemptionError, "Unknown coupon redemption error."),
        });
      }
    }

    await ensureConfirmedOnChainPaymentAllocations(updatedPayment.id);

    await tryDispatchAdminNotification("payment.confirmed", {
      entityId: updatedPayment.id,
      title: `Payment confirmed ${updatedOrder.order_number || updatedOrder.id}`,
      message: `On-chain payment was confirmed for order ${updatedOrder.order_number || updatedOrder.id}.`,
      href: `/admin/orders/${updatedOrder.id}`,
      amount: updatedPayment.amount_expected_fiat,
      metadata: {
        paymentId: updatedPayment.id,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        paymentMethod: updatedPayment.payment_method,
        txHash: updatedPayment.tx_hash,
      },
    });
    await tryDispatchAdminNotification("payment.onchain_confirmed", {
      entityId: updatedPayment.id,
      title: `On-chain payment confirmed ${updatedOrder.order_number || updatedOrder.id}`,
      message: `${updatedPayment.payment_method.toUpperCase()} payment confirmed on-chain.`,
      href: `/admin/orders/${updatedOrder.id}`,
      amount: updatedPayment.amount_expected_fiat,
      metadata: {
        paymentId: updatedPayment.id,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        paymentMethod: updatedPayment.payment_method,
        txHash: updatedPayment.tx_hash,
      },
    });

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
