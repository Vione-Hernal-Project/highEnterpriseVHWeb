"use client";

import { useState } from "react";

import { getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  email: string;
};

export function ResendConfirmationButton({ email }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleClick() {
    if (!email || loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/auth/resend-confirmation", {
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
        throw new Error(getResponseErrorMessage(payload, "Unable to resend the confirmation email right now."));
      }

      setIsError(false);
      setMessage(payload?.message || "If this account still needs confirmation, a fresh confirmation email has been sent.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to resend the confirmation email right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vh-auth-resend">
      <button type="button" className="vh-auth-link vh-auth-link--button" disabled={loading} onClick={() => void handleClick()}>
        {loading ? "Sending..." : "Resend Confirmation Email"}
      </button>
      {message ? <div className={`vh-status ${isError ? "vh-status--error" : "vh-status--success"}`}>{message}</div> : null}
    </div>
  );
}
