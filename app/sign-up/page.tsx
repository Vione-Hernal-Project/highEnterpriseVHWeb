import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

export default async function SignUpPage() {
  logPublicSupabaseEnvStatus("sign-up-page");

  const configError = getPublicSupabaseEnvError();

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Supabase Auth MVP</p>
          <h2 className="vh-mvp-title">Create your account and test the full flow.</h2>
          <p className="vh-mvp-copy">
            Once signed up, you can place a mock order, track payment attempts, and view your history from a protected
            dashboard.
          </p>
          {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/sign-in">
              Already Have An Account
            </Link>
          </div>
        </div>
        <SignUpForm configError={configError} />
      </div>
    </section>
  );
}
