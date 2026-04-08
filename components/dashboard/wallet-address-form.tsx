"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  initialWalletAddress: string | null;
};

export function WalletAddressForm({ initialWalletAddress }: Props) {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: walletAddress.trim() || null,
        }),
      });

      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        setError(getResponseErrorMessage(payload, "Unable to save the wallet address."));
        return;
      }

      setMessage("Wallet address saved.");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error, "Unable to save the wallet address."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="vh-field">
        <label htmlFor="wallet-address">Saved Wallet Address</label>
        <input
          id="wallet-address"
          value={walletAddress}
          onChange={(event) => setWalletAddress(event.target.value)}
          className="vh-input"
          placeholder="Optional for your customer profile"
        />
        <p className="vh-payment-note">
          This saves your profile wallet only. Store payments always go to the fixed merchant wallet configured on the server.
        </p>
      </div>
      {error ? <div className="vh-status vh-status--error">{error}</div> : null}
      {message ? <div className="vh-status vh-status--success">{message}</div> : null}
      <div className="vh-actions">
        <button type="submit" className="vh-button vh-button--ghost" disabled={loading}>
          {loading ? "Saving..." : "Save Wallet Address"}
        </button>
      </div>
    </form>
  );
}
