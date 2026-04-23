"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  orderId: string;
  initialStatus: "pending" | "paid" | "cancelled" | string;
  allowedStatuses?: string[];
};

export function AdminOrderStatusForm({ orderId, initialStatus, allowedStatuses }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const statusLocked = initialStatus === "paid";
  const defaultStatuses = statusLocked ? [initialStatus] : initialStatus === "cancelled" ? ["cancelled", "pending"] : ["pending", "cancelled"];
  const statusOptions = Array.from(new Set([initialStatus, ...(allowedStatuses || defaultStatuses)]));

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="vh-actions" style={{ marginTop: 0 }}>
        <select
          className="vh-input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={loading || statusLocked}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="vh-button vh-button--ghost"
          disabled={loading || statusLocked || status === initialStatus}
          onClick={async () => {
            setLoading(true);
            setMessage("");
            setError("");

            try {
              const response = await fetch("/api/admin/orders", {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ orderId, status }),
              });

              const payload = await readJsonSafely<{ error?: string }>(response);

              if (!response.ok) {
                setError(getResponseErrorMessage(payload, "Unable to update the order."));
                return;
              }

              setMessage("Order updated.");
              router.refresh();
            } catch (error) {
              setError(getErrorMessage(error, "Unable to update the order."));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Saving..." : "Update"}
        </button>
      </div>
      {statusLocked ? (
        <div className="vh-status" style={{ marginTop: "0.75rem" }}>
          Paid orders are read-only here and can only be set by verified on-chain payment confirmation.
        </div>
      ) : null}
      {error ? <div className="vh-status vh-status--error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
      {message ? <div className="vh-status vh-status--success" style={{ marginTop: "0.75rem" }}>{message}</div> : null}
    </div>
  );
}
