import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentSession } from "@/lib/auth";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

type Props = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getResetErrorMessage(error: string | undefined) {
  if (error === "invalid_or_expired_link") {
    return "This reset link is invalid or has expired. Request a new password reset email and try again.";
  }

  return null;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  logPublicSupabaseEnvStatus("reset-password-page");

  const [{ error }, { user }] = await Promise.all([searchParams, getCurrentSession()]);
  const configError = getPublicSupabaseEnvError();
  const resetError = getResetErrorMessage(error);
  const accessError = !configError && !resetError && !user ? "This reset link is invalid or has expired." : null;
  const pageError = configError || resetError || accessError;

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Password Recovery</p>
          <h2 className="vh-mvp-title">Set a new password for your account.</h2>
          <p className="vh-mvp-copy">
            Once your new password is saved, you will be redirected back to sign in with the updated credentials.
          </p>
          {pageError ? <div className="vh-status vh-status--error">{pageError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href={pageError ? "/forgot-password" : "/sign-in"}>
              {pageError ? "Request New Link" : "Back To Sign In"}
            </Link>
          </div>
        </div>
        {pageError ? (
          <div className="vh-form-card">
            <h1 className="h2 u-margin-b--lg">Reset Password</h1>
            <div className="vh-status vh-status--error">{pageError}</div>
          </div>
        ) : (
          <ResetPasswordForm configError={configError} />
        )}
      </div>
    </section>
  );
}
