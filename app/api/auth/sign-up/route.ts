import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPasswordStrengthError, getPasswordStrengthInputs, passwordStrengthRules } from "@/lib/auth/password-strength";
import { resolveAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { serverEnv } from "@/lib/env/server";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";

const SIGN_UP_WINDOW_MS = 15 * 60_000;
const SIGN_UP_IP_LIMIT = 10;
const SIGN_UP_EMAIL_LIMIT = 4;
const SIGN_UP_BODY_LIMIT_BYTES = 8 * 1024;

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(passwordStrengthRules.minLength, `Password must be at least ${passwordStrengthRules.minLength} characters.`),
});

function getSafeSignUpErrorMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("error sending confirmation email")) {
    return "We couldn't send the confirmation email right now. Please try again shortly. If this keeps happening, contact support.";
  }

  if (normalizedMessage.includes("redirect") && normalizedMessage.includes("url")) {
    return "Account creation is blocked by an email redirect configuration issue. Please contact support.";
  }

  if (normalizedMessage.includes("database error saving new user")) {
    return "The account could not be created right now because the profile setup failed. Please try again shortly.";
  }

  return message || "Unable to create the account right now.";
}

export async function POST(request: Request) {
  try {
    if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the deployment environment." },
        { status: 500 },
      );
    }

    const bodySizeError = getJsonBodySizeError(request, SIGN_UP_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid sign-up request." }, { status: 400 });
    }

    const passwordStrengthError = getPasswordStrengthError(parsed.data.password, getPasswordStrengthInputs(parsed.data.email));

    if (passwordStrengthError) {
      return NextResponse.json(
        {
          error: `${passwordStrengthError} Use a unique password with uppercase, lowercase, numbers, symbols, and no predictable personal words.`,
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIp(request);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const ipRateLimit = await applyRateLimit({
      key: `auth:sign-up:ip:${ipAddress}`,
      limit: SIGN_UP_IP_LIMIT,
      windowMs: SIGN_UP_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many account creation attempts were made from this connection. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const emailRateLimit = await applyRateLimit({
      key: `auth:sign-up:email:${normalizedEmail}`,
      limit: SIGN_UP_EMAIL_LIMIT,
      windowMs: SIGN_UP_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many account creation attempts were made for this email. Please wait a few minutes and try again." },
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

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: parsed.data.password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("[auth:sign-up]", {
        message: error.message,
        name: error.name,
        status: "status" in error ? error.status : null,
        code: "code" in error ? error.code : null,
        redirectTo,
        requestOrigin: requestUrl.origin,
        requestHost: requestUrl.host,
        hasConfiguredPublicSiteUrl: Boolean(serverEnv.publicSiteUrl),
        configuredPublicSiteUrl: serverEnv.publicSiteUrl ? serverEnv.publicSiteUrl : null,
        nodeEnv: process.env.NODE_ENV ?? null,
      });

      return NextResponse.json(
        { error: getSafeSignUpErrorMessage(error.message) },
        { status: typeof error.status === "number" ? error.status : 500 },
      );
    }

    const authUser = data.user;
    const isExistingUserLike =
      !data.session && Boolean(authUser) && Array.isArray(authUser?.identities) && authUser.identities.length === 0;

    return NextResponse.json({
      sessionCreated: Boolean(data.session),
      requiresEmailConfirmation: !data.session && Boolean(authUser),
      isExistingUserLike,
    });
  } catch (error) {
    console.error("[auth:sign-up]", {
      message: getErrorMessage(error, "Unexpected sign-up failure."),
      hasConfiguredPublicSiteUrl: Boolean(serverEnv.publicSiteUrl),
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to create the account right now.") },
      { status: 500 },
    );
  }
}
