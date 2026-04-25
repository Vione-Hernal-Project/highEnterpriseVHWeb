import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { getBagCheckoutPricing, getCheckoutPricing } from "@/lib/payments/quotes";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";
import { orderLineItemSchema } from "@/lib/validations/order";

const PUBLIC_QUOTE_WINDOW_MS = 60_000;
const PUBLIC_QUOTE_GET_LIMIT = 60;
const PUBLIC_QUOTE_POST_LIMIT = 30;
const PUBLIC_QUOTE_BODY_LIMIT_BYTES = 32 * 1024;

const bagPricingRequestSchema = z.object({
  items: z.array(orderLineItemSchema).min(1, "Add at least one item to checkout."),
  shippingMethodCode: z.enum(["standard", "express"]).optional().nullable(),
  shippingAddress: z
    .object({
      address1: z.string().trim().optional().nullable(),
      city: z.string().trim().optional().nullable(),
      province: z.string().trim().optional().nullable(),
      postalCode: z.string().trim().optional().nullable(),
      country: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function GET(request: Request) {
  try {
    const ipAddress = getClientIp(request);
    const rateLimit = await applyRateLimit({
      key: `quotes:get:ip:${ipAddress}`,
      limit: PUBLIC_QUOTE_GET_LIMIT,
      windowMs: PUBLIC_QUOTE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many live quote requests were made from this connection. Please wait a moment and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit.resetAt),
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || "";
    const quantity = Number(searchParams.get("quantity") || "1");
    const pricing = await getCheckoutPricing(productId, quantity);

    return NextResponse.json({ pricing });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load the current ETH/PHP quote.") }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request);
    const rateLimit = await applyRateLimit({
      key: `quotes:post:ip:${ipAddress}`,
      limit: PUBLIC_QUOTE_POST_LIMIT,
      windowMs: PUBLIC_QUOTE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout quote requests were made from this connection. Please wait a moment and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit.resetAt),
        },
      );
    }

    const bodySizeError = getJsonBodySizeError(request, PUBLIC_QUOTE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = bagPricingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid checkout quote request." }, { status: 400 });
    }

    const pricing = await getBagCheckoutPricing(parsed.data.items, {
      shippingAddress: parsed.data.shippingAddress || undefined,
      shippingMethodCode: parsed.data.shippingMethodCode || undefined,
    });

    return NextResponse.json({ pricing });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load the current ETH/PHP quote.") }, { status: 400 });
  }
}
