"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  initialStatus: "pending" | "paid" | "cancelled" | string;
  allowedStatuses?: string[];
  variant?: "default" | "table";
};

export function AdminOrderStatusForm({ orderId, initialStatus, allowedStatuses, variant = "default" }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const statusLocked = initialStatus === "paid";
  const defaultStatuses = statusLocked ? [initialStatus] : initialStatus === "cancelled" ? ["cancelled", "pending"] : ["pending", "cancelled"];
  const statusOptions = Array.from(new Set([initialStatus, ...(allowedStatuses || defaultStatuses)]));
  const isTableVariant = variant === "table";
  const showInlineLockedHelper = isTableVariant && statusLocked;
  const helperId = statusLocked ? `order-status-helper-${orderId}` : undefined;

  return (
    <div className={cn("vh-admin-order-status-form", isTableVariant && "vh-admin-order-status-form--table")}>
      <div className="vh-actions vh-admin-order-status-form__controls">
        <select
          className="vh-input vh-admin-order-status-form__select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={loading || statusLocked}
          aria-label="Order status"
          aria-describedby={helperId}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        {showInlineLockedHelper ? (
          <small
            id={helperId}
            className="vh-admin-order-status-form__helper"
            title="Paid orders are controlled by verified payment confirmation."
          >
            Payment locked
          </small>
        ) : (
          <button
            type="button"
            className="vh-button vh-button--ghost vh-admin-order-status-form__button"
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
        )}
      </div>
      {statusLocked && !isTableVariant ? (
        <div id={helperId} className="vh-status vh-admin-order-status-form__status">
          Paid orders are read-only here and can only be set by verified on-chain payment confirmation.
        </div>
      ) : null}
      {error ? (
        isTableVariant ? (
          <small className="vh-admin-order-status-form__feedback vh-admin-order-status-form__feedback--error" role="alert">{error}</small>
        ) : (
          <div className="vh-status vh-status--error vh-admin-order-status-form__status">{error}</div>
        )
      ) : null}
      {message ? (
        isTableVariant ? (
          <small className="vh-admin-order-status-form__feedback vh-admin-order-status-form__feedback--success" role="status">{message}</small>
        ) : (
          <div className="vh-status vh-status--success vh-admin-order-status-form__status">{message}</div>
        )
      ) : null}
    </div>
  );
}
