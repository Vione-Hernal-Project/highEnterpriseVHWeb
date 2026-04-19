"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  profileId: string;
  initialRole: "user" | "staff" | "admin" | "owner" | string;
  disabled?: boolean;
};

export function ProfileRoleForm({ profileId, initialRole, disabled = false }: Props) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole === "admin" ? "admin" : initialRole === "staff" ? "staff" : "user");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="vh-actions" style={{ marginTop: 0 }}>
        <select className="vh-input" value={role} onChange={(event) => setRole(event.target.value)} disabled={loading || disabled}>
          <option value="user">User</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          className="vh-button vh-button--ghost"
          disabled={loading || disabled}
          onClick={async () => {
            setLoading(true);
            setMessage("");
            setError("");

            try {
              const response = await fetch("/api/admin/profiles/role", {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ profileId, role }),
              });

              const payload = await readJsonSafely<{ error?: string }>(response);

              if (!response.ok) {
                setError(getResponseErrorMessage(payload, "Unable to update the profile role."));
                return;
              }

              setMessage("Role updated.");
              router.refresh();
            } catch (error) {
              setError(getErrorMessage(error, "Unable to update the profile role."));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Saving..." : "Save Role"}
        </button>
      </div>
      {error ? <div className="vh-status vh-status--error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
      {message ? <div className="vh-status vh-status--success" style={{ marginTop: "0.75rem" }}>{message}</div> : null}
    </div>
  );
}
