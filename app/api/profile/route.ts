import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { logPaymentDebug } from "@/lib/payments/debug";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { walletSchema } from "@/lib/validations/order";

const PROFILE_UPDATE_WINDOW_MS = 10 * 60_000;
const PROFILE_UPDATE_USER_LIMIT = 20;
const PROFILE_UPDATE_BODY_LIMIT_BYTES = 8 * 1024;

export async function GET() {
  const { supabase, user, role } = await getCurrentUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data, role });
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const bodySizeError = getJsonBodySizeError(request, PROFILE_UPDATE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `profile:update:user:${user.id}`,
      limit: PROFILE_UPDATE_USER_LIMIT,
      windowMs: PROFILE_UPDATE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many profile update attempts were made for this account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = walletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid wallet address." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          wallet_address: parsed.data.walletAddress ?? null,
        },
        {
          onConflict: "id",
        },
      )
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to save the wallet address right now." }, { status: 500 });
    }

    logPaymentDebug("wallet-save", {
      userId: user.id,
      email: user.email ?? null,
      savedWalletAddress: data.wallet_address,
    });

    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to save the wallet address right now.") },
      { status: 500 },
    );
  }
}
