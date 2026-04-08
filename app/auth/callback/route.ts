import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
    return NextResponse.redirect(new URL("/sign-in?devError=supabase_config_missing", requestUrl.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
