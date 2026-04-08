"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  configError?: string | null;
};

export function SignUpForm({ configError = null }: Props) {
  const router = useRouter();
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
      const password = String(formData.get("password") || "");
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setMessage(
        data.session
          ? "Account created and signed in."
          : "Account created. If email confirmation is enabled, please confirm your email before signing in.",
      );

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Unable to create the account right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vh-form-card">
      <h1 className="h2 u-margin-b--lg">Create Account</h1>
      <div className="vh-field">
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" name="email" type="email" className="vh-input" autoComplete="email" required />
      </div>
      <div className="vh-field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          className="vh-input"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
      {message ? <div className={`vh-status ${success ? "vh-status--success" : "vh-status--error"}`}>{message}</div> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button" disabled={loading || Boolean(configError)}>
          {loading ? "Creating..." : "Create Account"}
        </button>
      </div>
    </form>
  );
}
