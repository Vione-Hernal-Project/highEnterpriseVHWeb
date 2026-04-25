import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage } from "@/lib/http";
import { buildRateLimitHeaders, applyRateLimit, clearRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SIGN_IN_WINDOW_MS = 10 * 60_000;
const SIGN_IN_IP_LIMIT = 20;
const SIGN_IN_EMAIL_LIMIT = 8;

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function getSafeSignInErrorMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }

  return "Unable to sign in right now.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = signInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid sign-in request." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const ipRateLimitKey = `auth:sign-in:ip:${ipAddress}`;
    const emailRateLimitKey = `auth:sign-in:email:${normalizedEmail}`;
    const ipRateLimit = applyRateLimit({
      key: ipRateLimitKey,
      limit: SIGN_IN_IP_LIMIT,
      windowMs: SIGN_IN_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts were made from this connection. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const emailRateLimit = applyRateLimit({
      key: emailRateLimitKey,
      limit: SIGN_IN_EMAIL_LIMIT,
      windowMs: SIGN_IN_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts were made for this account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(emailRateLimit.resetAt),
        },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error) {
      return NextResponse.json(
        { error: getSafeSignInErrorMessage(error.message) },
        { status: error.message.toLowerCase().includes("email not confirmed") ? 403 : 401 },
      );
    }

    clearRateLimit(ipRateLimitKey);
    clearRateLimit(emailRateLimitKey);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to sign in right now.") },
      { status: 500 },
    );
  }
}
