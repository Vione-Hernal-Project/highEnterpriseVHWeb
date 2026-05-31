import { NextResponse } from "next/server";
import { getAddress } from "ethers";
import { PublicKey } from "@solana/web3.js";

import { DEFAULT_GENERAL_SETTINGS, loadFreshAdminGeneralSettings } from "@/lib/admin/settings";
import { getCurrentUserContext } from "@/lib/auth";
import { getEthereumMainnetRpcEnvError, getSolanaRpcEnvError } from "@/lib/env/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { tryDispatchAdminNotification } from "@/lib/admin/notifications";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { generateOrderNumber } from "@/lib/orders";
import { phpCentsToDecimalString } from "@/lib/payments/amounts";
import { resolveCheckoutInput } from "@/lib/payments/checkout";
import { logPaymentDebug } from "@/lib/payments/debug";
import { resolveMerchantWalletAddress, resolveSolanaMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { getPaymentMethodConfig, getPaymentMethodLabel, getPaymentMethodSetupError } from "@/lib/payments/options";
import { getBagCheckoutPricing } from "@/lib/payments/quotes";
import { applyRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildNormalizedShippingAddress } from "@/lib/shipping";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";
import { orderSchema } from "@/lib/validations/order";
import { ETHEREUM_MAINNET_CHAIN_ID, SOLANA_MAINNET_CHAIN_ID } from "@/lib/web3/network";

const ORDER_CREATION_WINDOW_MS = 10 * 60_000;
const ORDER_CREATION_USER_LIMIT = 6;
const ORDER_CREATION_IP_LIMIT = 20;
const MAX_PENDING_ORDERS_PER_USER = 3;
const MAX_RECENT_ORDERS_PER_USER = 12;
const ORDER_CREATION_BODY_LIMIT_BYTES = 64 * 1024;

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
    const settings = await loadFreshAdminGeneralSettings().catch(() => DEFAULT_GENERAL_SETTINGS);

    if (!settings.enableStore) {
      return NextResponse.json({ error: "The online store is currently under maintenance." }, { status: 503 });
    }

    const { user } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const bodySizeError = getJsonBodySizeError(request, ORDER_CREATION_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order payload." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const ipRateLimit = await applyRateLimit({
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

    const userRateLimit = await applyRateLimit({
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

    const paymentSetupError = getPaymentMethodSetupError(parsed.data.paymentMethod);

    if (paymentSetupError) {
      return NextResponse.json({ error: paymentSetupError }, { status: 400 });
    }

    const paymentConfig = getPaymentMethodConfig(parsed.data.paymentMethod);
    const isSolanaPayment = paymentConfig?.network === "solana";
    const rpcSetupError = isSolanaPayment ? getSolanaRpcEnvError() : getEthereumMainnetRpcEnvError();

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
      paymentMethod: parsed.data.paymentMethod,
      couponCode: parsed.data.couponCode,
      userId: user.id,
      customerEmail: user.email ?? null,
    });

    if (!pricing.isShippingResolved || !pricing.shippingMethodCode || pricing.shippingFeePhpCents === null) {
      return NextResponse.json({ error: pricing.shippingMessage || "Shipping is unavailable for this address yet." }, { status: 400 });
    }

    const resolvedInput = resolveCheckoutInput({
      amountMode: parsed.data.amountMode,
      enteredAmount: parsed.data.enteredAmount,
      pricing,
      paymentMethod: parsed.data.paymentMethod,
    });

    if (!resolvedInput.ok) {
      return NextResponse.json({ error: resolvedInput.error }, { status: 400 });
    }

    const merchantWallet = isSolanaPayment ? await resolveSolanaMerchantWalletAddress() : await resolveMerchantWalletAddress();
    const admin = createSupabaseAdminClient();
    const payerWalletAddress = isSolanaPayment
      ? new PublicKey(parsed.data.payerWalletAddress).toBase58()
      : getAddress(parsed.data.payerWalletAddress);
    const chainId = isSolanaPayment ? SOLANA_MAINNET_CHAIN_ID : ETHEREUM_MAINNET_CHAIN_ID;
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
    const attribution = parsed.data.attribution || {};
    const attributionSource = attribution.source || attribution.utmSource || "online_store";
    const attributionMedium = attribution.medium || attribution.utmMedium || "checkout";
    const attributionCampaign = attribution.campaignName || attribution.utmCampaign || attribution.campaignId || null;
    const orderAttribution = {
      ...attribution,
      source: attributionSource,
      medium: attributionMedium,
    };

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
      couponCode: pricing.couponCode,
      discountPhp: pricing.discountPhp,
      taxLabel: pricing.taxLabel,
      taxPhp: pricing.taxPhp,
      shippingMethodCode: pricing.shippingMethodCode,
      shippingZone: pricing.shippingZone,
      totalPhp: pricing.totalPhp,
      requiredEth: pricing.requiredEth,
      enteredAmount: parsed.data.enteredAmount,
      amountMode: parsed.data.amountMode,
      payableCryptoAmount: resolvedInput.payableCryptoAmount,
      payerWalletAddress,
      recipientAddress: merchantWallet.address,
      recipientSource: merchantWallet.source,
      chainId,
    });

    // Order creation stays server-side so the browser never gets direct write
    // access to the protected commerce tables. The route is also rate-limited
    // here so checkout abuse controls stay aligned with the live server flow.
    const orderInsertPayload = {
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
        delivery_latitude: parsed.data.deliveryLatitude,
        delivery_longitude: parsed.data.deliveryLongitude,
        delivery_place_id: parsed.data.deliveryPlaceId,
        delivery_map_provider: parsed.data.deliveryMapProvider,
        delivery_address_components: parsed.data.deliveryAddressComponents || {},
        subtotal_amount: pricing.subtotalPhp,
        tax_amount: pricing.taxPhp,
        tax_rate_label: pricing.taxLabel,
        tax_rate_percent: pricing.taxRatePercent.toString(),
        tax_breakdown: {
          ruleId: pricing.taxRuleId,
          label: pricing.taxLabel,
          ratePercent: pricing.taxRatePercent,
          taxableAmountPhpCents: pricing.taxableAmountPhpCents,
          taxableAmountPhp: pricing.taxableAmountPhp,
          taxPhpCents: pricing.taxPhpCents,
        },
        ...(pricing.couponId
          ? {
              coupon_id: pricing.couponId,
              coupon_code: pricing.couponCode,
              discount_amount: pricing.discountPhp,
              discount_breakdown: {
                couponLabel: pricing.couponLabel,
                productDiscountPhpCents: pricing.productDiscountPhpCents,
                shippingDiscountPhpCents: pricing.shippingDiscountPhpCents,
                totalBeforeDiscountPhpCents: pricing.totalBeforeDiscountPhpCents,
              },
            }
          : {}),
        amount: pricing.totalPhp,
        currency: "PHP",
        status: "pending",
        notes: parsed.data.notes,
        source: attributionSource,
        medium: attributionMedium,
        campaign_id: attribution.campaignId || null,
        campaign_name: attributionCampaign,
        utm_source: attribution.utmSource || null,
        utm_medium: attribution.utmMedium || null,
        utm_campaign: attribution.utmCampaign || null,
        attribution_data: orderAttribution,
        confirmation_email_status: "pending",
      };

    let { data: order, error: orderError } = await admin
      .from("orders")
      .insert(orderInsertPayload)
      .select("*")
      .single();

    if (orderError && /delivery_|tax_|schema cache|Could not find/i.test(orderError.message || "")) {
      const {
        delivery_latitude: _deliveryLatitude,
        delivery_longitude: _deliveryLongitude,
        delivery_place_id: _deliveryPlaceId,
        delivery_map_provider: _deliveryMapProvider,
        delivery_address_components: _deliveryAddressComponents,
        tax_amount: _taxAmount,
        tax_rate_label: _taxRateLabel,
        tax_rate_percent: _taxRatePercent,
        tax_breakdown: _taxBreakdown,
        ...legacyOrderInsertPayload
      } = orderInsertPayload;

      const retryResult = await admin.from("orders").insert(legacyOrderInsertPayload).select("*").single();
      order = retryResult.data;
      orderError = retryResult.error;
    }

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
        payment_type: parsed.data.paymentMethod,
        wallet_provider: paymentConfig?.walletProvider || null,
        network: isSolanaPayment ? "mainnet-beta" : "ethereum-mainnet",
        token_type: paymentConfig?.tokenType || null,
        token_standard: paymentConfig?.tokenStandard || null,
        sender_wallet_address: payerWalletAddress,
        wallet_address: payerWalletAddress,
        recipient_address: merchantWallet.address,
        chain_id: chainId,
        amount_expected: pricing.requiredCryptoAmount,
        amount_expected_fiat: pricing.totalPhp,
        fiat_currency: "PHP",
        conversion_rate: pricing.phpPerCrypto.toFixed(6),
        usd_conversion_rate: pricing.usdPhpRate?.toFixed(6) ?? null,
        coingecko_crypto_price: pricing.coingeckoCryptoUsdPrice?.toFixed(12) ?? null,
        binance_crypto_price: pricing.binanceCryptoUsdPrice?.toFixed(12) ?? null,
        price_difference_percent: pricing.priceDifferencePercent?.toFixed(6) ?? null,
        slippage_buffer_percent: pricing.slippageBufferPercent.toFixed(4),
        base_crypto_amount: pricing.baseCryptoAmount,
        slippage_buffer_amount: pricing.slippageBufferAmount,
        quote_source: pricing.quoteSource,
        quote_updated_at: pricing.quoteUpdatedAt,
        quote_expires_at: pricing.quoteExpiresAt,
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
      taxLabel: pricing.taxLabel,
      taxAmount: pricing.taxPhp,
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

    await tryDispatchAdminNotification("order.new", {
      entityId: order.id,
      title: `New order ${order.order_number || order.id}`,
      message: `${parsed.data.customerName} placed an order for PHP ${pricing.totalPhp}.`,
      href: `/admin/orders/${order.id}`,
      customerEmail: user.email ?? null,
      customerName: parsed.data.customerName,
      amount: pricing.totalPhp,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment.id,
        paymentMethod: parsed.data.paymentMethod,
      },
    });

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
        couponCode: pricing.couponCode,
        couponLabel: pricing.couponLabel,
        couponMessage: pricing.couponMessage,
        discountPhp: pricing.discountPhp,
        discountPhpLabel: pricing.discountPhpLabel,
        taxLabel: pricing.taxLabel,
        taxPhp: pricing.taxPhp,
        taxPhpLabel: pricing.taxPhpLabel,
        shippingMethodCode: pricing.shippingMethodCode,
        shippingMethodLabel: pricing.shippingMethodLabel,
        shippingZone: pricing.shippingZone,
        shippingZoneLabel: pricing.shippingZoneLabel,
        totalPhp: pricing.totalPhp,
        totalPhpLabel: pricing.totalPhpLabel,
        requiredEth: pricing.requiredCryptoAmount,
        requiredEthLabel: pricing.requiredCryptoLabel,
        payableEthAmount: resolvedInput.payableCryptoAmount,
        payableEthLabel: `${resolvedInput.payableCryptoAmount} ${getPaymentMethodLabel(parsed.data.paymentMethod)}`,
        requiredCryptoAmount: pricing.requiredCryptoAmount,
        requiredCryptoLabel: pricing.requiredCryptoLabel,
        payableCryptoAmount: resolvedInput.payableCryptoAmount,
        payableCryptoLabel: `${resolvedInput.payableCryptoAmount} ${getPaymentMethodLabel(parsed.data.paymentMethod)}`,
        amountMode: parsed.data.amountMode,
        enteredAmount: resolvedInput.enteredAmount,
        enteredAmountLabel: resolvedInput.enteredAmountLabel,
        phpPerEth: pricing.phpPerCrypto.toFixed(6),
        phpPerEthLabel: pricing.phpPerCryptoLabel,
        phpPerCrypto: pricing.phpPerCrypto.toFixed(6),
        phpPerCryptoLabel: pricing.phpPerCryptoLabel,
        cryptoSymbol: pricing.cryptoSymbol,
        quoteSource: pricing.quoteSource,
        quoteUpdatedAt: pricing.quoteUpdatedAt,
        estimatedUsdLabel: pricing.estimatedUsdLabel,
        estimatedUsdValue: pricing.estimatedUsdValue,
        usdPhpRate: pricing.usdPhpRate,
        baseCryptoAmount: pricing.baseCryptoAmount,
        baseCryptoLabel: pricing.baseCryptoLabel,
        slippageBufferPercent: pricing.slippageBufferPercent,
        slippageBufferLabel: pricing.slippageBufferLabel,
        slippageBufferAmount: pricing.slippageBufferAmount,
        slippageBufferAmountLabel: pricing.slippageBufferAmountLabel,
        networkFeeEstimateAmount: pricing.networkFeeEstimateAmount,
        networkFeeEstimateLabel: pricing.networkFeeEstimateLabel,
        networkFeeEstimateSymbol: pricing.networkFeeEstimateSymbol,
        estimatedTotalLabel: pricing.estimatedTotalLabel,
        quoteExpiresAt: pricing.quoteExpiresAt,
        quoteTtlSeconds: pricing.quoteTtlSeconds,
      },
      recipientWalletAddress: merchantWallet.address,
      chainId,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to create the order right now.") }, { status: 500 });
  }
}
