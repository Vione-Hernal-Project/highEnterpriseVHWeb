"use client";

import { useState, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  configError?: string | null;
};

export function ForgotPasswordForm({ configError = null }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      if (configError) {
        throw new Error(configError);
      }

      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim();
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setMessage("If an account exists for that email, a reset link has been sent.");
      event.currentTarget.reset();
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Unable to send the reset link right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vh-form-card">
      <h1 className="h2 u-margin-b--lg">Forgot Password</h1>
      <div className="vh-field">
        <label htmlFor="forgot-password-email">Email</label>
        <input id="forgot-password-email" name="email" type="email" className="vh-input" autoComplete="email" required />
      </div>
      {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
      {message ? <div className={`vh-status ${success ? "vh-status--success" : "vh-status--error"}`}>{message}</div> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button" disabled={loading || Boolean(configError)}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </div>
    </form>
  );
}
