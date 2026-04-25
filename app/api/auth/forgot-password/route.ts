import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { buildRateLimitHeaders, applyRateLimit, getClientIp } from "@/lib/security/rate-limit";

const FORGOT_PASSWORD_WINDOW_MS = 15 * 60_000;
const FORGOT_PASSWORD_IP_LIMIT = 8;
const FORGOT_PASSWORD_EMAIL_LIMIT = 3;
const GENERIC_RESET_MESSAGE = "If an account exists for that email, a reset link has been sent.";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

function resolveResetCallbackUrl(requestUrl: URL) {
  const configuredSiteUrl = serverEnv.publicSiteUrl.trim();

  if (configuredSiteUrl) {
    try {
      const siteUrl = new URL(configuredSiteUrl);

      if (
        process.env.NODE_ENV === "production" &&
        (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1")
      ) {
        return new URL("/auth/callback?next=/reset-password", requestUrl.origin).toString();
      }

      return new URL("/auth/callback?next=/reset-password", siteUrl).toString();
    } catch {
      // Fall back to the current request origin when the configured site URL is invalid.
    }
  }

  return new URL("/auth/callback?next=/reset-password", requestUrl.origin).toString();
}

function getSafeForgotPasswordErrorMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("redirect") && normalizedMessage.includes("url")) {
    return "Password reset is unavailable right now because the email redirect configuration is incomplete. Please contact support.";
  }

  if (normalizedMessage.includes("error sending recovery email") || normalizedMessage.includes("error sending email")) {
    return "We couldn't send the password reset email right now. Please try again shortly. If this keeps happening, contact support.";
  }

  return "Unable to send the reset link right now.";
}

export async function POST(request: Request) {
  try {
    if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the deployment environment." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid password reset request." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const ipRateLimit = applyRateLimit({
      key: `auth:forgot-password:ip:${ipAddress}`,
      limit: FORGOT_PASSWORD_IP_LIMIT,
      windowMs: FORGOT_PASSWORD_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password reset attempts were made from this connection. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const emailRateLimit = applyRateLimit({
      key: `auth:forgot-password:email:${normalizedEmail}`,
      limit: FORGOT_PASSWORD_EMAIL_LIMIT,
      windowMs: FORGOT_PASSWORD_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password reset attempts were made for this email. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(emailRateLimit.resetAt),
        },
      );
    }

    const redirectTo = resolveResetCallbackUrl(new URL(request.url));
    const supabase = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      console.error("[auth:forgot-password]", {
        message: error.message,
        name: error.name,
        status: "status" in error ? error.status : null,
        code: "code" in error ? error.code : null,
        redirectTo,
        requestOrigin: new URL(request.url).origin,
        hasConfiguredPublicSiteUrl: Boolean(serverEnv.publicSiteUrl),
      });

      return NextResponse.json(
        { error: getSafeForgotPasswordErrorMessage(error.message) },
        { status: typeof error.status === "number" ? error.status : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RESET_MESSAGE,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to send the reset link right now." },
      { status: 500 },
    );
  }
}
