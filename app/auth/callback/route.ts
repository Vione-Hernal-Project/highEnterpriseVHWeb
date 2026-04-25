import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

function resolveNextPath(requestUrl: URL) {
  const requestedNext = requestUrl.searchParams.get("next") || "";

  if (!requestedNext.startsWith("/") || requestedNext.startsWith("//")) {
    return "/dashboard";
  }

  return requestedNext;
}

function getOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }

  if (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  ) {
    return value;
  }

  return null;
}

function getCallbackSuccessPath(params: {
  nextPath: string;
  otpType: EmailOtpType | null;
  requestUrl: URL;
}) {
  if (params.otpType === "recovery" || params.nextPath === "/reset-password") {
    return params.nextPath === "/dashboard" ? "/reset-password" : params.nextPath;
  }

  if (
    params.otpType === "signup" ||
    (!params.requestUrl.searchParams.has("next") && !params.requestUrl.searchParams.has("redirect_to"))
  ) {
    return "/sign-in?confirmed=success";
  }

  return params.nextPath;
}

function isPasswordRecoveryFlow(params: { otpType: EmailOtpType | null; nextPath: string }) {
  return params.otpType === "recovery" || params.nextPath === "/reset-password";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = getOtpType(requestUrl.searchParams.get("type"));
  const nextPath = resolveNextPath(requestUrl);

  if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
    return NextResponse.redirect(new URL("/sign-in?devError=supabase_config_missing", requestUrl.origin));
  }

  if (code || (tokenHash && otpType)) {
    const { supabase, applyPendingCookies } = await createSupabaseRouteHandlerClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash as string,
          type: otpType as EmailOtpType,
        });
    const { error } = result;

    if (error) {
      const fallbackPath = isPasswordRecoveryFlow({ otpType, nextPath })
        ? "/reset-password?error=invalid_or_expired_link"
        : "/sign-in?error=confirmation_link_invalid";
      return NextResponse.redirect(new URL(fallbackPath, requestUrl.origin));
    }

    if (!isPasswordRecoveryFlow({ otpType, nextPath })) {
      await supabase.auth.signOut();
    }

    return applyPendingCookies(
      NextResponse.redirect(new URL(getCallbackSuccessPath({ nextPath, otpType, requestUrl }), requestUrl.origin)),
    );
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
