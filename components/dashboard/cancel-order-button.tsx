"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  orderId: string;
};

export function CancelOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmOpen]);

  async function handleCancelOrder() {
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

      setConfirmOpen(false);
      setMessage("Order cancelled.");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error, "Unable to cancel the order."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="vh-button vh-button--ghost"
        disabled={loading}
        onClick={() => {
          setMessage("");
          setError("");
          setConfirmOpen(true);
        }}
      >
        {loading ? "Cancelling..." : "Cancel Order"}
      </button>
      {confirmOpen ? (
        <div className="vh-modal-backdrop" role="presentation" onClick={() => !loading && setConfirmOpen(false)}>
          <div
            className="vh-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`cancel-order-title-${orderId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="vh-modal__eyebrow">Cancel Order</p>
            <h3 id={`cancel-order-title-${orderId}`} className="vh-modal__title">
              Cancel this pending order?
            </h3>
            <p className="vh-modal__copy">
              This is only available before a MetaMask transaction has been submitted on-chain.
            </p>
            <div className="vh-modal__actions">
              <button type="button" className="vh-button vh-button--ghost" disabled={loading} onClick={() => setConfirmOpen(false)}>
                Keep Order
              </button>
              <button type="button" className="vh-button" disabled={loading} onClick={() => void handleCancelOrder()}>
                {loading ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <div className="vh-status vh-status--error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
      {message ? <div className="vh-status vh-status--success" style={{ marginTop: "0.75rem" }}>{message}</div> : null}
    </div>
  );
}
