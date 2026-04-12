import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { fetchEthPhpQuote } from "@/lib/payments/quotes";

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const quote = await fetchEthPhpQuote();

    return NextResponse.json({
      quote,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load the live ETH/PHP quote right now.") }, { status: 400 });
  }
}
