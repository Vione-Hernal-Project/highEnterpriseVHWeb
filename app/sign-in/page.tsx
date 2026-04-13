import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

type Props = {
  searchParams: Promise<{
    devError?: string;
    next?: string;
    error?: string;
    reset?: string;
  }>;
};

export default async function SignInPage({ searchParams }: Props) {
  logPublicSupabaseEnvStatus("sign-in-page");

  const { devError, next, error, reset } = await searchParams;
  const configError =
    getPublicSupabaseEnvError() ||
    (devError === "supabase_config_missing"
      ? "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the Next.js dev server."
      : null);
  const resetSuccessMessage = reset === "success" ? "Password updated. Sign in with your new password." : null;
  const callbackError =
    error === "auth_callback_failed" ? "The authentication link could not be completed. Please try again." : null;

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Vione Hernal Access</p>
          <h2 className="vh-mvp-title">Sign in to place a Sepolia order.</h2>
          <p className="vh-mvp-copy">
            This MVP uses Supabase Auth for working email and password login, protected routes, and order history tied
            to the signed-in account.
          </p>
          {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
          {resetSuccessMessage ? <div className="vh-status vh-status--success">{resetSuccessMessage}</div> : null}
          {callbackError ? <div className="vh-status vh-status--error">{callbackError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/sign-up">
              Create Account
            </Link>
          </div>
        </div>
        <SignInForm nextPath={next || "/dashboard"} configError={configError} />
      </div>
    </section>
  );
}
