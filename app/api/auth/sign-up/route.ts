import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getErrorMessage } from "@/lib/http";
import { serverEnv } from "@/lib/env/server";

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

function resolveAuthCallbackUrl(requestUrl: URL) {
  const configuredSiteUrl = serverEnv.publicSiteUrl.trim();

  if (configuredSiteUrl) {
    try {
      const siteUrl = new URL(configuredSiteUrl);

      if (
        process.env.NODE_ENV === "production" &&
        (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1")
      ) {
        return new URL("/auth/callback", requestUrl.origin).toString();
      }

      return new URL("/auth/callback", siteUrl).toString();
    } catch {
      // Fall back to the current request origin when the configured site URL is invalid.
    }
  }

  return new URL("/auth/callback", requestUrl.origin).toString();
}

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

    const body = await request.json().catch(() => null);
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid sign-up request." }, { status: 400 });
    }

    const redirectTo = resolveAuthCallbackUrl(new URL(request.url));
    const supabase = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
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
        requestOrigin: new URL(request.url).origin,
        hasConfiguredPublicSiteUrl: Boolean(serverEnv.publicSiteUrl),
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
    });

    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to create the account right now.") },
      { status: 500 },
    );
  }
}
