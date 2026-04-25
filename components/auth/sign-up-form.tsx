"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  configError?: string | null;
};

export function SignUpForm({ configError = null }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function setGenericSignUpMessage() {
    setSuccess(true);
    setMessage(
      "If this email can be used, the sign-up request was accepted. Check your inbox if email confirmation is enabled, or try signing in.",
    );
  }

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
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const payload = await readJsonSafely<{
        error?: string;
        sessionCreated?: boolean;
        requiresEmailConfirmation?: boolean;
        isExistingUserLike?: boolean;
      }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to create the account right now."));
      }

      if (payload?.isExistingUserLike) {
        setGenericSignUpMessage();
        return;
      }

      if (payload?.sessionCreated) {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setSuccess(true);
        setMessage("Account created and signed in.");
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setSuccess(true);
      setMessage(
        payload?.requiresEmailConfirmation
          ? "Account created. Please confirm your email before signing in."
          : "Account created. If email confirmation is enabled, please confirm your email before signing in.",
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to create the account right now.";
      const normalizedMessage = errorMessage.toLowerCase();

      if (normalizedMessage.includes("already registered")) {
        setGenericSignUpMessage();
        return;
      }

      setSuccess(false);
      setMessage(errorMessage);
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
        showStrengthFeedback
        strengthMinLength={10}
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
