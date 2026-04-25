import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { buildRateLimitHeaders, applyRateLimit, clearRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

const SIGN_IN_WINDOW_MS = 10 * 60_000;
const SIGN_IN_IP_LIMIT = 20;
const SIGN_IN_EMAIL_LIMIT = 8;
const SIGN_IN_BODY_LIMIT_BYTES = 8 * 1024;

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  nextPath: z.string().trim().optional(),
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

function resolveNextPath(value: string | undefined) {
  const requestedPath = (value || "").trim();

  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return "/dashboard";
  }

  return requestedPath;
}

export async function POST(request: Request) {
  try {
    const bodySizeError = getJsonBodySizeError(request, SIGN_IN_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = signInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid sign-in request." }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const redirectTo = resolveNextPath(parsed.data.nextPath);
    const ipRateLimitKey = `auth:sign-in:ip:${ipAddress}`;
    const emailRateLimitKey = `auth:sign-in:email:${normalizedEmail}`;
    const ipRateLimit = await applyRateLimit({
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

    const emailRateLimit = await applyRateLimit({
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

    console.info("[auth:sign-in]", {
      phase: "started",
      requestOrigin: new URL(request.url).origin,
      redirectTo,
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    const { supabase, applyPendingCookies } = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error) {
      console.info("[auth:sign-in]", {
        phase: "failed",
        status: error.message.toLowerCase().includes("email not confirmed") ? 403 : 401,
        errorMessage: error.message,
        hasSession: Boolean(data.session),
        redirectTo,
      });

      return applyPendingCookies(NextResponse.json(
        { error: getSafeSignInErrorMessage(error.message) },
        { status: error.message.toLowerCase().includes("email not confirmed") ? 403 : 401 },
      ));
    }

    if (!data.session) {
      console.info("[auth:sign-in]", {
        phase: "failed",
        status: 500,
        errorMessage: "No Supabase session returned after successful sign-in.",
        hasSession: false,
        redirectTo,
      });

      return applyPendingCookies(
        NextResponse.json({ error: "Unable to establish the account session right now." }, { status: 500 }),
      );
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();

      console.info("[auth:sign-in]", {
        phase: "failed",
        status: 403,
        errorMessage: "Email address is not confirmed yet.",
        hasSession: false,
        redirectTo,
      });

      return applyPendingCookies(
        NextResponse.json({ error: "Confirm your email before signing in." }, { status: 403 }),
      );
    }

    await clearRateLimit(ipRateLimitKey);
    await clearRateLimit(emailRateLimitKey);

    console.info("[auth:sign-in]", {
      phase: "completed",
      status: 200,
      errorMessage: null,
      hasSession: true,
      redirectTo,
    });

    return applyPendingCookies(
      NextResponse.json({
        success: true,
        redirectTo,
        sessionCreated: true,
      }),
    );
  } catch (error) {
    console.error("[auth:sign-in]", {
      phase: "crashed",
      message: getErrorMessage(error, "Unable to sign in right now."),
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to sign in right now.") },
      { status: 500 },
    );
  }
}
