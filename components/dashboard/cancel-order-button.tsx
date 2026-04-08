"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  orderId: string;
};

export function CancelOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div>
      <button
        type="button"
        className="vh-button vh-button--ghost"
        disabled={loading}
        onClick={async () => {
          const shouldCancel = window.confirm("Cancel this order?");

          if (!shouldCancel) {
            return;
          }

          setLoading(true);
          setMessage("");
          setError("");

          try {
            const response = await fetch("/api/orders/cancel", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ orderId }),
            });

            const payload = await readJsonSafely<{ error?: string }>(response);

            if (!response.ok) {
              setError(getResponseErrorMessage(payload, "Unable to cancel the order."));
              return;
            }

            setMessage("Order cancelled.");
            router.refresh();
          } catch (error) {
            setError(getErrorMessage(error, "Unable to cancel the order."));
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Cancelling..." : "Cancel Order"}
      </button>
      {error ? <div className="vh-status vh-status--error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
      {message ? <div className="vh-status vh-status--success" style={{ marginTop: "0.75rem" }}>{message}</div> : null}
    </div>
  );
}
