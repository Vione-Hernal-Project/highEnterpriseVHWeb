"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_ROLE_LABELS, ADMIN_ROLE_VALUES, type AdminRole } from "@/lib/admin/access";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { formatDateTime } from "@/lib/utils";

type AdminProfileRow = {
  id: string;
  email: string;
  role: AdminRole;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  profiles: AdminProfileRow[];
};

const INVITABLE_ROLES = ADMIN_ROLE_VALUES.filter((role) => role !== "super_admin");

export function AdminAccessSettingsPanel({ profiles }: Props) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("full_admin");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function inviteAdmin() {
    setBusyKey("invite");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/profiles/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        setError(getResponseErrorMessage(payload, "Unable to invite this admin."));
        return;
      }

      setInviteEmail("");
      setMessage("Admin invitation sent.");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error, "Unable to invite this admin."));
    } finally {
      setBusyKey("");
    }
  }

  async function updateRole(profileId: string, role: AdminRole | "user") {
    setBusyKey(`${profileId}:${role}`);
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
        setError(getResponseErrorMessage(payload, "Unable to update this admin."));
        return;
      }

      setMessage(role === "user" ? "Admin access removed." : "Admin role updated.");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error, "Unable to update this admin."));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="vh-admin-settings-grid vh-admin-settings-grid--wide">
      <section className="vh-admin-panel vh-admin-panel--wide">
        <h2>Invite Admin</h2>
        <div className="vh-admin-form-grid">
          <label className="vh-admin-form-field">
            <span>Email Address</span>
            <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="admin@example.com" type="email" />
          </label>
          <label className="vh-admin-form-field">
            <span>Role</span>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AdminRole)}>
              {INVITABLE_ROLES.map((role) => (
                <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="vh-actions">
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="button" onClick={inviteAdmin} disabled={busyKey === "invite" || !inviteEmail.trim()}>
            <span>{busyKey === "invite" ? "Sending..." : "Invite Admin"}</span>
          </button>
        </div>
        {error ? <div className="vh-status vh-status--error" style={{ marginTop: "1rem" }}>{error}</div> : null}
        {message ? <div className="vh-status vh-status--success" style={{ marginTop: "1rem" }}>{message}</div> : null}
      </section>

      <section className="vh-admin-panel vh-admin-panel--wide">
        <h2>Admin Access</h2>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length ? profiles.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <div className="vh-admin-customer-cell">
                    <div aria-hidden="true">{profile.email.slice(0, 1).toUpperCase()}</div>
                    <span><strong>{profile.email}</strong><small>{profile.id}</small></span>
                  </div>
                </td>
                <td>
                  <span className="vh-admin-status-badge vh-admin-status-badge--active">{ADMIN_ROLE_LABELS[profile.role]}</span>
                </td>
                <td>{formatDateTime(profile.createdAt)}</td>
                <td>{formatDateTime(profile.updatedAt)}</td>
                <td>
                  <div className="vh-admin-row-actions">
                    <select
                      className="vh-input"
                      value={profile.role}
                      disabled={profile.protected || busyKey.startsWith(`${profile.id}:`)}
                      onChange={(event) => void updateRole(profile.id, event.target.value as AdminRole)}
                    >
                      {ADMIN_ROLE_VALUES.map((role) => (
                        <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                    <button
                      className="vh-admin-view-button"
                      type="button"
                      disabled={profile.protected || busyKey === `${profile.id}:user`}
                      onClick={() => void updateRole(profile.id, "user")}
                    >
                      {profile.protected ? "Owner" : busyKey === `${profile.id}:user` ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>
                  <div className="vh-admin-empty-state">
                    <strong>No admins yet.</strong>
                    <p>Invited admins will appear here after their profile is created.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
