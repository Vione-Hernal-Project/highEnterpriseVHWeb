"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { ResendConfirmationButton } from "@/components/auth/resend-confirmation-button";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  nextPath: string;
  configError?: string | null;
};

export function SignInForm({ nextPath, configError = null }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (configError) {
        throw new Error(configError);
      }

      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      setSubmittedEmail(email);
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          nextPath,
        }),
      });
      const payload = await readJsonSafely<{ error?: string; redirectTo?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to sign in right now."));
      }

      const redirectTo = payload?.redirectTo || nextPath;

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to sign in right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vh-form-card">
      <h1 className="h2 u-margin-b--lg">Sign In</h1>
      <div className="vh-field">
        <label htmlFor="signin-email">Email</label>
        <input id="signin-email" name="email" type="email" className="vh-input" autoComplete="email" required />
      </div>
      <PasswordField id="signin-password" name="password" label="Password" autoComplete="current-password" required />
      <div className="vh-form-inline-link">
        <Link href="/forgot-password">Forgot Password?</Link>
      </div>
      {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
      {message ? <div className="vh-status vh-status--error">{message}</div> : null}
      {message.toLowerCase().includes("confirm your email") && submittedEmail ? <ResendConfirmationButton email={submittedEmail} /> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button" disabled={loading || Boolean(configError)}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </div>
    </form>
  );
}
