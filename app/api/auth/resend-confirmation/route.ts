import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { resolveAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { serverEnv } from "@/lib/env/server";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";

const RESEND_WINDOW_MS = 15 * 60_000;
const RESEND_IP_LIMIT = 6;
const RESEND_EMAIL_LIMIT = 3;
const RESEND_BODY_LIMIT_BYTES = 8 * 1024;

const resendConfirmationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

function getSafeResendMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("error sending confirmation email")) {
    return "We couldn't send a new confirmation email right now. Please try again shortly.";
  }

  if (normalizedMessage.includes("email rate limit")) {
    return "A confirmation email was sent recently. Please wait a few minutes before requesting another one.";
  }

  if (normalizedMessage.includes("redirect") && normalizedMessage.includes("url")) {
    return "Confirmation email redirects are not configured correctly right now. Please contact support.";
  }

  return "We couldn't send a new confirmation email right now. Please try again shortly.";
}

export async function POST(request: Request) {
  try {
    if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the deployment environment." },
        { status: 500 },
      );
    }

    const bodySizeError = getJsonBodySizeError(request, RESEND_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = resendConfirmationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid resend request." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const ipRateLimit = await applyRateLimit({
      key: `auth:resend-confirmation:ip:${ipAddress}`,
      limit: RESEND_IP_LIMIT,
      windowMs: RESEND_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many confirmation email requests were made from this connection. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const emailRateLimit = await applyRateLimit({
      key: `auth:resend-confirmation:email:${normalizedEmail}`,
      limit: RESEND_EMAIL_LIMIT,
      windowMs: RESEND_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: "A confirmation email was sent recently. Please wait a few minutes before requesting another one." },
        {
          status: 429,
          headers: buildRateLimitHeaders(emailRateLimit.resetAt),
        },
      );
    }

    const requestUrl = new URL(request.url);
    const redirectTo = resolveAuthRedirectUrl({
      configuredSiteUrl: serverEnv.publicSiteUrl,
      requestUrl,
      path: "/auth/callback",
    });
    const supabase = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("[auth:resend-confirmation]", {
        message: error.message,
        name: error.name,
        status: "status" in error ? error.status : null,
        code: "code" in error ? error.code : null,
        redirectTo,
        requestOrigin: requestUrl.origin,
        requestHost: requestUrl.host,
        nodeEnv: process.env.NODE_ENV ?? null,
      });

      return NextResponse.json({ error: getSafeResendMessage(error.message) }, { status: typeof error.status === "number" ? error.status : 500 });
    }

    return NextResponse.json({
      success: true,
      message: "If this account still needs confirmation, a fresh confirmation email has been sent.",
    });
  } catch (error) {
    console.error("[auth:resend-confirmation]", {
      message: getErrorMessage(error, "Unexpected resend confirmation failure."),
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to resend the confirmation email right now.") },
      { status: 500 },
    );
  }
}
