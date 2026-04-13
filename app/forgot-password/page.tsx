import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

export default async function ForgotPasswordPage() {
  logPublicSupabaseEnvStatus("forgot-password-page");

  const configError = getPublicSupabaseEnvError();

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Password Recovery</p>
          <h2 className="vh-mvp-title">Request a secure password reset link.</h2>
          <p className="vh-mvp-copy">
            Enter the email tied to your Vione Hernal account and we will send a Supabase password reset link if the
            account is registered.
          </p>
          {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/sign-in">
              Back To Sign In
            </Link>
          </div>
        </div>
        <ForgotPasswordForm configError={configError} />
      </div>
    </section>
  );
}
