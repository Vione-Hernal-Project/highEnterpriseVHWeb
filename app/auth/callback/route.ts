import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";

function resolveNextPath(requestUrl: URL) {
  const requestedNext = requestUrl.searchParams.get("next") || "";

  if (!requestedNext.startsWith("/") || requestedNext.startsWith("//")) {
    return "/dashboard";
  }

  return requestedNext;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = resolveNextPath(requestUrl);

  if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
    return NextResponse.redirect(new URL("/sign-in?devError=supabase_config_missing", requestUrl.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const fallbackPath = nextPath === "/reset-password" ? "/reset-password?error=invalid_or_expired_link" : "/sign-in?error=auth_callback_failed";
      return NextResponse.redirect(new URL(fallbackPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
