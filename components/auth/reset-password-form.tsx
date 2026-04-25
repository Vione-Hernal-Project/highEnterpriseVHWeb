"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  configError?: string | null;
};

export function ResetPasswordForm({ configError = null }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function getSafeResetPasswordMessage(error: unknown) {
    if (!(error instanceof Error)) {
      return "Unable to reset your password right now.";
    }

    const normalizedMessage = error.message.trim().toLowerCase();

    if (normalizedMessage.includes("passwords do not match")) {
      return "Passwords do not match.";
    }

    if (normalizedMessage.includes("invalid") || normalizedMessage.includes("expired")) {
      return "This reset link is invalid or has expired. Request a new password reset email and try again.";
    }

    return "Unable to reset your password right now.";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (configError) {
        throw new Error(configError);
      }

      const formData = new FormData(event.currentTarget);
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      router.push("/sign-in?reset=success");
      router.refresh();
    } catch (error) {
      setMessage(getSafeResetPasswordMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vh-form-card">
      <h1 className="h2 u-margin-b--lg">Reset Password</h1>
      <PasswordField
        id="reset-password"
        name="password"
        label="New Password"
        autoComplete="new-password"
        minLength={6}
        required
      />
      <PasswordField
        id="reset-password-confirm"
        name="confirmPassword"
        label="Confirm Password"
        autoComplete="new-password"
        minLength={6}
        required
      />
      {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
      {message ? <div className="vh-status vh-status--error">{message}</div> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button" disabled={loading || Boolean(configError)}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
}
