import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { logPaymentDebug } from "@/lib/payments/debug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { walletSchema } from "@/lib/validations/order";

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
