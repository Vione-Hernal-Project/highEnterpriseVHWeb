import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Unable to validate email right now." }, { status: 500 });
    }

    if (data?.id) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to validate email right now.") }, { status: 500 });
  }
}
