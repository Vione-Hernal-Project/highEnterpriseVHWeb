"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getResponseErrorMessage, readJsonSafely } from "@/lib/http";

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
      const duplicateCheckResponse = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const duplicateCheckPayload = await readJsonSafely<{ error?: string }>(duplicateCheckResponse);

      if (!duplicateCheckResponse.ok) {
        throw new Error(getResponseErrorMessage(duplicateCheckPayload, "Unable to validate email right now."));
      }

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

      if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("Email already registered");
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
      <PasswordField
        id="signup-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        minLength={6}
        required
      />
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
