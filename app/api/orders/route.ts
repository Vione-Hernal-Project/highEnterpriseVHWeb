import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getProductAvailableSizes } from "@/lib/catalog";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSepoliaRpcEnvError } from "@/lib/env/server";
import { getErrorMessage } from "@/lib/http";
import { generateOrderNumber } from "@/lib/orders";
import { phpCentsToDecimalString } from "@/lib/payments/amounts";
import { resolveCheckoutInput } from "@/lib/payments/checkout";
import { logPaymentDebug } from "@/lib/payments/debug";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { getPaymentMethodSetupError } from "@/lib/payments/options";
import { getCheckoutPricing } from "@/lib/payments/quotes";
import { loadPublishedCatalogProduct } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";
import { orderSchema } from "@/lib/validations/order";
import { SEPOLIA_CHAIN_ID } from "@/lib/web3/config";

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

    const rpcSetupError = getSepoliaRpcEnvError();

    if (rpcSetupError) {
      return NextResponse.json({ error: rpcSetupError }, { status: 400 });
    }

    const product = await loadPublishedCatalogProduct(parsed.data.productId);

    if (!product) {
      return NextResponse.json({ error: "Selected product was not found." }, { status: 404 });
    }

    if (!getProductAvailableSizes(product).includes(parsed.data.selectedSize)) {
      return NextResponse.json({ error: "Selected size is unavailable for this product." }, { status: 400 });
    }

    const pricing = await getCheckoutPricing(product.id, parsed.data.quantity);
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
    const orderNumber = generateOrderNumber();

    logPaymentDebug("order-create", {
      orderNumber,
      userId: user.id,
      payerProfileEmail: user.email ?? null,
      productId: product.id,
      productName: product.name,
      quantity: pricing.quantity,
      paymentMethod: parsed.data.paymentMethod,
      subtotalPhp: pricing.subtotalPhp,
      requiredEth: pricing.requiredEth,
      enteredAmount: parsed.data.enteredAmount,
      amountMode: parsed.data.amountMode,
      payableEthAmount: resolvedInput.payableEthAmount,
      recipientAddress: merchantWallet.address,
      recipientSource: merchantWallet.source,
      chainId: SEPOLIA_CHAIN_ID,
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
        product_id: product.id,
        product_name: product.name,
        selected_size: parsed.data.selectedSize,
        quantity: pricing.quantity,
        unit_price: phpCentsToDecimalString(product.pricePhpCents),
        customer_name: parsed.data.customerName,
        phone: parsed.data.phone,
        shipping_address: parsed.data.shippingAddress,
        amount: pricing.subtotalPhp,
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

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: user.id,
        payment_method: parsed.data.paymentMethod,
        wallet_address: null,
        recipient_address: merchantWallet.address,
        chain_id: SEPOLIA_CHAIN_ID,
        amount_expected: pricing.requiredEth,
        amount_expected_fiat: pricing.subtotalPhp,
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

    const emailResult = await sendOrderConfirmationEmail({
      to: user.email,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      amount: order.amount,
      currency: order.currency,
      paymentMethod: payment.payment_method,
      notes: order.notes,
      shippingAddress: order.shipping_address,
    });

    const { data: updatedOrder } = await admin
      .from("orders")
      .update({
        confirmation_email_status: emailResult.status,
        confirmation_email_sent_at: emailResult.sentAt ?? null,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    return NextResponse.json({
      order: updatedOrder ?? {
        ...order,
        confirmation_email_status: emailResult.status,
        confirmation_email_sent_at: emailResult.sentAt ?? null,
      },
      payment,
      pricing: {
        subtotalPhp: pricing.subtotalPhp,
        subtotalPhpLabel: pricing.subtotalPhpLabel,
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
      chainId: SEPOLIA_CHAIN_ID,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to create the order right now.") }, { status: 500 });
  }
}
