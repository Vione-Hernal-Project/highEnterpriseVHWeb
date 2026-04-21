import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage } from "@/lib/http";
import { getBagCheckoutPricing, getCheckoutPricing } from "@/lib/payments/quotes";
import { orderLineItemSchema } from "@/lib/validations/order";

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
