import { NextResponse } from "next/server";
import { getAddress } from "ethers";

import { getCurrentUserContext } from "@/lib/auth";
import { getEthereumMainnetRpcEnvError } from "@/lib/env/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getErrorMessage } from "@/lib/http";
import { generateOrderNumber } from "@/lib/orders";
import { phpCentsToDecimalString } from "@/lib/payments/amounts";
import { resolveCheckoutInput } from "@/lib/payments/checkout";
import { logPaymentDebug } from "@/lib/payments/debug";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { getPaymentMethodSetupError } from "@/lib/payments/options";
import { getBagCheckoutPricing } from "@/lib/payments/quotes";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildNormalizedShippingAddress } from "@/lib/shipping";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";
import { orderSchema } from "@/lib/validations/order";
import { ETHEREUM_MAINNET_CHAIN_ID } from "@/lib/web3/network";

const ORDER_CREATION_WINDOW_MS = 10 * 60_000;
const ORDER_CREATION_USER_LIMIT = 6;
const ORDER_CREATION_IP_LIMIT = 20;
const MAX_PENDING_ORDERS_PER_USER = 3;
const MAX_RECENT_ORDERS_PER_USER = 12;

function buildRateLimitHeaders(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    "Retry-After": String(retryAfterSeconds),
  };
}

async function loadOrderAbuseWindow(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const recentWindowStart = new Date(Date.now() - ORDER_CREATION_WINDOW_MS).toISOString();

  const [{ count: pendingOrdersCount, error: pendingOrdersError }, { count: recentOrdersCount, error: recentOrdersError }] =
    await Promise.all([
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", recentWindowStart),
    ]);

  if (pendingOrdersError || recentOrdersError) {
    throw new Error(
      pendingOrdersError?.message || recentOrdersError?.message || "Unable to validate the order safety window.",
    );
  }

  return {
    pendingOrdersCount: pendingOrdersCount || 0,
    recentOrdersCount: recentOrdersCount || 0,
  };
}

export async function GET() {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data || [] });
}

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order payload." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const ipRateLimit = applyRateLimit({
      key: `orders:ip:${ipAddress}`,
      limit: ORDER_CREATION_IP_LIMIT,
      windowMs: ORDER_CREATION_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout attempts from this connection. Please wait a few minutes before trying again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const userRateLimit = applyRateLimit({
      key: `orders:user:${user.id}`,
      limit: ORDER_CREATION_USER_LIMIT,
      windowMs: ORDER_CREATION_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many order attempts were created for this account. Please wait a few minutes before trying again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    if (parsed.data.paymentMethod !== "eth") {
      return NextResponse.json(
        { error: "PHP-priced live checkout is currently available for ETH payments only." },
        { status: 400 },
      );
    }

    const paymentSetupError = getPaymentMethodSetupError(parsed.data.paymentMethod);

    if (paymentSetupError) {
      return NextResponse.json({ error: paymentSetupError }, { status: 400 });
    }

    const rpcSetupError = getEthereumMainnetRpcEnvError();

    if (rpcSetupError) {
      return NextResponse.json({ error: rpcSetupError }, { status: 400 });
    }

    const requestedItems =
      parsed.data.items?.length
        ? parsed.data.items
        : [
            {
              productId: parsed.data.productId?.trim() || "",
              selectedSize: parsed.data.selectedSize?.trim() || "",
              quantity: parsed.data.quantity ?? 1,
            },
          ];
    const shippingAddressInput = {
      address1: parsed.data.shippingAddressLine1,
      city: parsed.data.shippingCity,
      province: parsed.data.shippingProvince,
      postalCode: parsed.data.shippingPostalCode,
      country: parsed.data.shippingCountry,
    };

    const pricing = await getBagCheckoutPricing(requestedItems, {
      shippingAddress: shippingAddressInput,
      shippingMethodCode: parsed.data.shippingMethodCode,
    });

    if (!pricing.isShippingResolved || !pricing.shippingMethodCode || pricing.shippingFeePhpCents === null) {
      return NextResponse.json({ error: pricing.shippingMessage || "Shipping is unavailable for this address yet." }, { status: 400 });
    }

    const resolvedInput = resolveCheckoutInput({
      amountMode: parsed.data.amountMode,
      enteredAmount: parsed.data.enteredAmount,
      pricing,
    });

    if (!resolvedInput.ok) {
      return NextResponse.json({ error: resolvedInput.error }, { status: 400 });
    }

    const merchantWallet = await resolveMerchantWalletAddress();
    const admin = createSupabaseAdminClient();
    const payerWalletAddress = getAddress(parsed.data.payerWalletAddress);
    const abuseWindow = await loadOrderAbuseWindow(admin, user.id);

    if (abuseWindow.pendingOrdersCount >= MAX_PENDING_ORDERS_PER_USER) {
      return NextResponse.json(
        {
          error:
            "This account already has too many unresolved pending orders. Cancel an older pending order or finish its payment before creating another one.",
        },
        { status: 429 },
      );
    }

    if (abuseWindow.recentOrdersCount >= MAX_RECENT_ORDERS_PER_USER) {
      return NextResponse.json(
        {
          error: "Order creation is temporarily limited for this account. Please wait a few minutes before trying again.",
        },
        { status: 429 },
      );
    }

    const orderNumber = generateOrderNumber();
    const primaryItem = pricing.items[0];
    const orderProductId = pricing.itemCount === 1 ? primaryItem?.product.id || null : null;
    const orderProductName = pricing.itemCount === 1 ? primaryItem?.product.name || null : `${pricing.itemCount} items`;
    const orderSelectedSize = pricing.itemCount === 1 ? primaryItem?.selectedSize || null : null;
    const orderUnitPrice = pricing.itemCount === 1 ? primaryItem?.product.pricePhpCents || 0 : 0;

    logPaymentDebug("order-create", {
      orderNumber,
      userId: user.id,
      payerProfileEmail: user.email ?? null,
      itemCount: pricing.itemCount,
      totalQuantity: pricing.totalQuantity,
      productIds: pricing.items.map((item) => item.product.id),
      paymentMethod: parsed.data.paymentMethod,
      subtotalPhp: pricing.subtotalPhp,
      shippingFeePhp: pricing.shippingFeePhp,
      shippingMethodCode: pricing.shippingMethodCode,
      shippingZone: pricing.shippingZone,
      totalPhp: pricing.totalPhp,
      requiredEth: pricing.requiredEth,
      enteredAmount: parsed.data.enteredAmount,
      amountMode: parsed.data.amountMode,
      payableEthAmount: resolvedInput.payableEthAmount,
      payerWalletAddress,
      recipientAddress: merchantWallet.address,
      recipientSource: merchantWallet.source,
      chainId: ETHEREUM_MAINNET_CHAIN_ID,
    });

    // Order creation stays server-side so the browser never gets direct write
    // access to the protected commerce tables. Rate limiting can be added here
    // later at the proxy or hosting layer without changing the client flow.
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        email: user.email ?? null,
        product_id: orderProductId,
        product_name: orderProductName,
        selected_size: orderSelectedSize,
        quantity: pricing.totalQuantity,
        unit_price: phpCentsToDecimalString(orderUnitPrice),
        customer_name: parsed.data.customerName,
        phone: parsed.data.phone,
        shipping_address: buildNormalizedShippingAddress(shippingAddressInput),
        shipping_address_line1: pricing.normalizedShippingAddress.address1,
        shipping_city: pricing.normalizedShippingAddress.city,
        shipping_province: pricing.normalizedShippingAddress.province,
        shipping_postal_code: pricing.normalizedShippingAddress.postalCode,
        shipping_country: pricing.normalizedShippingAddress.country,
        shipping_zone: pricing.shippingZone,
        shipping_method: pricing.shippingMethodCode,
        shipping_fee: pricing.shippingFeePhp,
        subtotal_amount: pricing.subtotalPhp,
        amount: pricing.totalPhp,
        currency: "PHP",
        status: "pending",
        notes: parsed.data.notes,
        confirmation_email_status: "pending",
      })
      .select("*")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: getSupabaseTableErrorMessage(orderError?.message, "Unable to create order.") },
        { status: 500 },
      );
    }

    const { error: orderItemsError } = await admin.from("order_items").insert(
      pricing.items.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_brand: item.product.brand,
        selected_size: item.selectedSize,
        quantity: item.quantity,
        unit_price: phpCentsToDecimalString(item.product.pricePhpCents),
        line_total: item.lineTotalPhp,
      })),
    );

    if (orderItemsError) {
      await admin.from("orders").delete().eq("id", order.id);

      return NextResponse.json(
        { error: getSupabaseTableErrorMessage(orderItemsError.message, "Unable to save order items.") },
        { status: 500 },
      );
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: user.id,
        payment_method: parsed.data.paymentMethod,
        wallet_address: payerWalletAddress,
        recipient_address: merchantWallet.address,
        chain_id: ETHEREUM_MAINNET_CHAIN_ID,
        amount_expected: pricing.requiredEth,
        amount_expected_fiat: pricing.totalPhp,
        fiat_currency: "PHP",
        conversion_rate: pricing.phpPerEth.toFixed(6),
        quote_source: pricing.quoteSource,
        quote_updated_at: pricing.quoteUpdatedAt,
        amount_received: null,
        status: "pending",
      })
      .select("*")
      .single();

    if (paymentError || !payment) {
      await admin.from("orders").delete().eq("id", order.id);

      return NextResponse.json(
        { error: getSupabaseTableErrorMessage(paymentError?.message, "Unable to create payment.") },
        { status: 500 },
      );
    }

    const orderEmailResult = await sendOrderConfirmationEmail({
      to: user.email ?? null,
      customerName: parsed.data.customerName,
      orderNumber: order.order_number,
      amount: pricing.totalPhp,
      currency: "PHP",
      paymentMethod: parsed.data.paymentMethod,
      itemLines: pricing.items.map((item) =>
        [item.product.brand, item.product.name, item.selectedSize ? `Size ${item.selectedSize}` : null, `Qty ${item.quantity}`]
          .filter(Boolean)
          .join(" · "),
      ),
      notes: parsed.data.notes || null,
      shippingAddress: buildNormalizedShippingAddress(pricing.normalizedShippingAddress),
      shippingMethodLabel: pricing.shippingMethodLabel,
      shippingFee: pricing.shippingFeePhp,
    });

    const { data: orderWithConfirmation } = await admin
      .from("orders")
      .update({
        confirmation_email_status: orderEmailResult.status,
        confirmation_email_sent_at: orderEmailResult.sentAt ?? null,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    return NextResponse.json({
      order: orderWithConfirmation ?? {
        ...order,
        confirmation_email_status: orderEmailResult.status,
        confirmation_email_sent_at: orderEmailResult.sentAt ?? null,
      },
      payment,
      pricing: {
        subtotalPhp: pricing.subtotalPhp,
        subtotalPhpLabel: pricing.subtotalPhpLabel,
        shippingFeePhp: pricing.shippingFeePhp,
        shippingFeeLabel: pricing.shippingFeeLabel,
        shippingMethodCode: pricing.shippingMethodCode,
        shippingMethodLabel: pricing.shippingMethodLabel,
        shippingZone: pricing.shippingZone,
        shippingZoneLabel: pricing.shippingZoneLabel,
        totalPhp: pricing.totalPhp,
        totalPhpLabel: pricing.totalPhpLabel,
        requiredEth: pricing.requiredEth,
        requiredEthLabel: pricing.requiredEthLabel,
        payableEthAmount: resolvedInput.payableEthAmount,
        payableEthLabel: `${resolvedInput.payableEthAmount} ETH`,
        amountMode: parsed.data.amountMode,
        enteredAmount: resolvedInput.enteredAmount,
        enteredAmountLabel: resolvedInput.enteredAmountLabel,
        phpPerEth: pricing.phpPerEth.toFixed(6),
        phpPerEthLabel: pricing.phpPerEthLabel,
        quoteSource: pricing.quoteSource,
        quoteUpdatedAt: pricing.quoteUpdatedAt,
      },
      recipientWalletAddress: merchantWallet.address,
      chainId: ETHEREUM_MAINNET_CHAIN_ID,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to create the order right now.") }, { status: 500 });
  }
}
