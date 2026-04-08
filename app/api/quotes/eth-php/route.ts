import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/http";
import { getCheckoutPricing } from "@/lib/payments/quotes";

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
