import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { loadPublicStorefrontSettings } from "@/lib/admin/settings";
import { getPublicSupabaseEnvError, logPublicSupabaseEnvStatus } from "@/lib/env/public";

export default async function SignUpPage() {
  logPublicSupabaseEnvStatus("sign-up-page");

  const configError = getPublicSupabaseEnvError();
  const settings = await loadPublicStorefrontSettings();

  return (
    <section className="vh-page-shell">
      <div className="vh-grid-two">
        <div className="vh-data-card">
          <p className="vh-mvp-eyebrow">Supabase Auth MVP</p>
          <h2 className="vh-mvp-title">
            {settings.allowCustomerRegistration ? "Create your account." : "Registration is currently paused."}
          </h2>
          <p className="vh-mvp-copy">
            {settings.allowCustomerRegistration
              ? "Once signed in, your account becomes your space to manage orders, revisit your selections, and move seamlessly through the Vione Hernal experience."
              : "New customer account creation is temporarily unavailable. Existing customers can still sign in."}
          </p>
          {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/sign-in">
              Already Have An Account
            </Link>
          </div>
        </div>
        {settings.allowCustomerRegistration ? (
          <SignUpForm configError={configError} />
        ) : (
          <div className="vh-form-card">
            <h1 className="h2 u-margin-b--lg">Create Account</h1>
            <div className="vh-status">
              <p className="u-margin-b--none">Customer registration is currently unavailable.</p>
            </div>
            <div className="vh-actions">
              <Link className="vh-button" href="/sign-in">
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
