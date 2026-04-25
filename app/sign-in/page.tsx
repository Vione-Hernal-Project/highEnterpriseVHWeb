import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

type Props = {
  searchParams: Promise<{
    devError?: string;
    next?: string;
    error?: string;
    reset?: string;
    confirmed?: string;
  }>;
};

function resolveNextPath(value: string | undefined) {
  const requestedPath = (value || "").trim();

  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return "/dashboard";
  }

  return requestedPath;
}

export default async function SignInPage({ searchParams }: Props) {
  logPublicSupabaseEnvStatus("sign-in-page");

  const { devError, next, error, reset, confirmed } = await searchParams;
  const configError =
    getPublicSupabaseEnvError() ||
    (devError === "supabase_config_missing"
      ? "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the Next.js dev server."
      : null);
  const resetSuccessMessage = reset === "success" ? "Password updated. Sign in with your new password." : null;
  const confirmedSuccessMessage = confirmed === "success" ? "Your account has been confirmed. You can now sign in." : null;
  const callbackError =
    error === "auth_callback_failed" ? "The authentication link could not be completed. Please try again." : null;

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Vione Hernal Access</p>
          <h2 className="vh-mvp-title">Sign up to place an order.</h2>
          <p className="vh-mvp-copy">
            Create your Vione Hernal account to place orders, follow your pieces, and access a refined experience
            shaped by your style.
          </p>
          {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
          {confirmedSuccessMessage ? <div className="vh-status vh-status--success">{confirmedSuccessMessage}</div> : null}
          {resetSuccessMessage ? <div className="vh-status vh-status--success">{resetSuccessMessage}</div> : null}
          {callbackError ? <div className="vh-status vh-status--error">{callbackError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/sign-up">
              Create Account
            </Link>
          </div>
        </div>
        <SignInForm nextPath={resolveNextPath(next)} configError={configError} />
      </div>
    </section>
  );
}
