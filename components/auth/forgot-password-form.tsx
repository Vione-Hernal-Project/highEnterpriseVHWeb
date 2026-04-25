"use client";

import { useState, type FormEvent } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

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
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });
      const payload = await readJsonSafely<{ error?: string; message?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to send the reset link right now."));
      }

      setSuccess(true);
      setMessage(payload?.message || "If an account exists for that email, a reset link has been sent.");
      event.currentTarget.reset();
    } catch (error) {
      setSuccess(false);
      setMessage(getErrorMessage(error, "Unable to send the reset link right now."));
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
