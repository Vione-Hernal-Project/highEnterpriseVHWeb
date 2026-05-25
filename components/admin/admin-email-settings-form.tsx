"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";

import type { AdminGeneralSettings } from "@/lib/admin/settings";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { cn } from "@/lib/utils";

const EMAIL_SETTINGS_FORM_ID = "vh-admin-email-settings-form";

type Props = {
  initialSettings: AdminGeneralSettings;
};

type EmailFieldKey = "fromName" | "fromEmail" | "replyToEmail" | "emailProvider";

function getEmailSettingsKey(settings: AdminGeneralSettings) {
  return [
    settings.fromName,
    settings.fromEmail,
    settings.replyToEmail,
    settings.emailProvider,
    settings.emailSslEnabled ? "ssl-on" : "ssl-off",
  ].join("|");
}

function getInitialTestEmail(settings: AdminGeneralSettings) {
  return settings.storeEmail || settings.replyToEmail || settings.fromEmail;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="vh-admin-form-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} disabled={disabled} />
    </label>
  );
}

export function AdminEmailSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form={EMAIL_SETTINGS_FORM_ID}>
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminEmailSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettingsKey, setSavedSettingsKey] = useState(() => getEmailSettingsKey(initialSettings));
  const [testEmail, setTestEmail] = useState(() => getInitialTestEmail(initialSettings));
  const [status, setStatus] = useState<"idle" | "saving" | "testing" | "saved" | "test-sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const hasUnsavedChanges = getEmailSettingsKey(settings) !== savedSettingsKey;
  const isBusy = status === "saving" || status === "testing";

  function update(key: EmailFieldKey, value: string) {
    setSettings((currentSettings) => ({ ...currentSettings, [key]: value }));
    setStatus("idle");
    setMessage("");
  }

  function updateSsl(value: boolean) {
    setSettings((currentSettings) => ({ ...currentSettings, emailSslEnabled: value }));
    setStatus("idle");
    setMessage("");
  }

  async function saveSettings(nextSettings: AdminGeneralSettings) {
    const response = await fetch("/api/admin/settings/general", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    const payload = await readJsonSafely<{ error?: string; settings?: AdminGeneralSettings }>(response);

    if (!response.ok || !payload?.settings) {
      throw new Error(getResponseErrorMessage(payload, "Unable to save email settings."));
    }

    return payload.settings;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const savedSettings = await saveSettings(settings);

      setSettings(savedSettings);
      setSavedSettingsKey(getEmailSettingsKey(savedSettings));
      setStatus("saved");
      setMessage("Email settings saved successfully");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error, "Unable to save email settings."));
    }
  }

  async function handleSendTestEmail() {
    setStatus("testing");
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          settings: {
            fromName: settings.fromName,
            fromEmail: settings.fromEmail,
            replyToEmail: settings.replyToEmail,
            emailProvider: settings.emailProvider,
            emailSslEnabled: settings.emailSslEnabled,
          },
        }),
      });
      const payload = await readJsonSafely<{ error?: string; message?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to send test email."));
      }

      setStatus("test-sent");
      setMessage(payload?.message || "Test email sent successfully");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error, "Unable to send test email."));
    }
  }

  return (
    <form id={EMAIL_SETTINGS_FORM_ID} className="vh-admin-settings-grid vh-admin-settings-grid--wide" onSubmit={handleSubmit}>
      {message ? (
        <div className={cn("vh-admin-form-alert vh-admin-panel--wide", status === "error" && "vh-admin-form-alert--error")} role="status">
          {message}
        </div>
      ) : null}
      {hasUnsavedChanges && status !== "saving" && status !== "saved" ? (
        <div className="vh-admin-form-alert vh-admin-form-alert--warning vh-admin-panel--wide" role="status">
          Email setting changes are not saved yet. Click Save Changes to persist them.
        </div>
      ) : null}

      <section className="vh-admin-panel">
        <h2>Email Configuration</h2>
        <div className="vh-admin-form-grid">
          <Field label="From Name" value={settings.fromName} onChange={(value) => update("fromName", value)} disabled={isBusy} />
          <Field label="From Email Address" value={settings.fromEmail} onChange={(value) => update("fromEmail", value)} type="email" disabled={isBusy} />
          <Field label="Reply To Email" value={settings.replyToEmail} onChange={(value) => update("replyToEmail", value)} type="email" disabled={isBusy} />
          <Field label="Email Provider" value={settings.emailProvider} onChange={(value) => update("emailProvider", value)} disabled={isBusy} />
        </div>
        <div className="vh-admin-toggle-row">
          <span>
            <strong>Enable SSL</strong>
            <small>Secure connection using TLS/SSL</small>
          </span>
          <button
            className={cn("vh-admin-toggle", settings.emailSslEnabled && "vh-admin-toggle--on")}
            type="button"
            role="switch"
            aria-checked={settings.emailSslEnabled}
            aria-label={`${settings.emailSslEnabled ? "Disable" : "Enable"} SSL`}
            onClick={() => updateSsl(!settings.emailSslEnabled)}
            disabled={isBusy}
          >
            <i />
          </button>
        </div>
      </section>

      <section className="vh-admin-panel">
        <h2>Test Email Settings</h2>
        <Field label="Send Test Email To" value={testEmail} onChange={setTestEmail} type="email" disabled={isBusy} />
        <button className="vh-admin-action-button vh-admin-action-button--primary" type="button" onClick={handleSendTestEmail} disabled={isBusy}>
          {status === "testing" ? "Sending..." : "Send Test Email"}
        </button>
      </section>

      {status === "saving" ? <p className="vh-admin-panel-copy vh-admin-panel--wide">Saving email settings...</p> : null}
      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit" disabled={isBusy}>
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Save Changes</span>
      </button>
    </form>
  );
}
