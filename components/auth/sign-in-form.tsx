"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  nextPath: string;
  configError?: string | null;
};

export function SignInForm({ nextPath, configError = null }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
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
      <div className="vh-field">
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          className="vh-input"
          autoComplete="current-password"
          required
        />
      </div>
      {configError ? <div className="vh-status vh-status--error">{configError}</div> : null}
      {message ? <div className="vh-status vh-status--error">{message}</div> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button" disabled={loading || Boolean(configError)}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </div>
    </form>
  );
}
