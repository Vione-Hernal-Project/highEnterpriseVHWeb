"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Save } from "lucide-react";

import {
  groupNotificationEventKeys,
  NOTIFICATION_EVENT_DEFINITIONS,
  type AdminNotificationSettings,
  type NotificationChannel,
  type NotificationEventKey,
} from "@/lib/notifications/definitions";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import type { AdminNotificationHistoryItem } from "@/lib/admin/notifications";
import { cn } from "@/lib/utils";

const NOTIFICATION_SETTINGS_FORM_ID = "vh-admin-notification-settings-form";
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
};

const RULE_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  sms: "SMS",
  push: "Admin/Push",
};

const CHANNEL_CONFIGURED: Record<NotificationChannel, boolean> = {
  email: true,
  sms: false,
  push: true,
};

type Props = {
  initialSettings: AdminNotificationSettings;
  historyRows: AdminNotificationHistoryItem[];
};

type NotificationField = keyof AdminNotificationSettings["preferences"];

function ToggleButton({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={cn("vh-admin-toggle", checked && "vh-admin-toggle--on")}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
    >
      <i />
    </button>
  );
}

function getSettingsKey(settings: AdminNotificationSettings) {
  return JSON.stringify(settings);
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AdminNotificationSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form={NOTIFICATION_SETTINGS_FORM_ID}>
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminNotificationSettingsForm({ initialSettings, historyRows }: Props) {
  const groups = useMemo(() => groupNotificationEventKeys(), []);
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettingsKey, setSavedSettingsKey] = useState(() => getSettingsKey(initialSettings));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasUnsavedChanges = getSettingsKey(settings) !== savedSettingsKey;
  const isBusy = status === "saving";

  function clearStatus() {
    setStatus("idle");
    setMessage("");
  }

function updateChannel(channel: NotificationChannel, enabled: boolean) {
    if (!CHANNEL_CONFIGURED[channel]) {
      return;
    }

    setSettings((current) => ({
      ...current,
      channels: { ...current.channels, [channel]: enabled },
    }));
    clearStatus();
  }

  function updatePreference(key: NotificationField, value: string | boolean) {
    setSettings((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
    clearStatus();
  }

function updateRule(eventKey: NotificationEventKey, channel: NotificationChannel, enabled: boolean) {
    if (!CHANNEL_CONFIGURED[channel]) {
      return;
    }

    setSettings((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [eventKey]: {
          ...current.rules[eventKey],
          [channel]: enabled,
        },
      },
    }));
    clearStatus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const settingsToSave: AdminNotificationSettings = {
        ...settings,
        channels: {
          ...settings.channels,
          sms: false,
        },
        rules: Object.fromEntries(
          Object.entries(settings.rules).map(([eventKey, rule]) => [eventKey, { ...rule, sms: false }]),
        ) as AdminNotificationSettings["rules"],
      };
      const response = await fetch("/api/admin/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });
      const payload = await readJsonSafely<{ error?: string; settings?: AdminNotificationSettings }>(response);

      if (!response.ok || !payload?.settings) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save notification settings."));
      }

      setSettings(payload.settings);
      setSavedSettingsKey(getSettingsKey(payload.settings));
      setStatus("saved");
      setMessage("Notification settings saved successfully");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error, "Unable to save notification settings."));
    }
  }

  return (
    <form id={NOTIFICATION_SETTINGS_FORM_ID} className="vh-admin-settings-grid vh-admin-settings-grid--wide" onSubmit={handleSubmit}>
      {message ? (
        <div className={cn("vh-admin-form-alert vh-admin-panel--wide", status === "error" && "vh-admin-form-alert--error")} role="status">
          {message}
        </div>
      ) : null}
      {hasUnsavedChanges && status !== "saving" && status !== "saved" ? (
        <div className="vh-admin-form-alert vh-admin-form-alert--warning vh-admin-panel--wide" role="status">
          Notification changes are not saved yet. Click Save Changes to persist them.
        </div>
      ) : null}

      <section className="vh-admin-panel">
        <h2>Notification Channels</h2>
        {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((channel) => (
          <div className="vh-admin-toggle-row" key={channel}>
            <span>
              <strong>{CHANNEL_LABELS[channel]} Notifications</strong>
              <small>
                {!CHANNEL_CONFIGURED[channel]
                  ? "Provider not configured yet."
                  : channel === "email"
                  ? "Send admin notification emails."
                  : channel === "sms"
                    ? "Log SMS events until a provider is connected."
                    : "Show admin notification center alerts."}
              </small>
            </span>
            <ToggleButton
              label={`${settings.channels[channel] ? "Disable" : "Enable"} ${CHANNEL_LABELS[channel]} notifications`}
              checked={CHANNEL_CONFIGURED[channel] && settings.channels[channel]}
              disabled={isBusy || !CHANNEL_CONFIGURED[channel]}
              onToggle={() => updateChannel(channel, !settings.channels[channel])}
            />
          </div>
        ))}
      </section>

      <section className="vh-admin-panel">
        <h2>Notification Preferences</h2>
        <div className="vh-admin-form-grid">
          <label className="vh-admin-form-field">
            <span>Language</span>
            <input value={settings.preferences.language} onChange={(event) => updatePreference("language", event.target.value)} disabled={isBusy} />
          </label>
          <label className="vh-admin-form-field">
            <span>Timezone</span>
            <input value={settings.preferences.timezone} onChange={(event) => updatePreference("timezone", event.target.value)} disabled={isBusy} />
          </label>
          <label className="vh-admin-form-field vh-admin-panel--wide">
            <span>Notification Email</span>
            <input
              value={settings.preferences.recipientEmail}
              onChange={(event) => updatePreference("recipientEmail", event.target.value)}
              type="email"
              disabled={isBusy}
            />
          </label>
          <label className="vh-admin-form-field">
            <span>Quiet Hours Start</span>
            <input
              value={settings.preferences.quietHoursStart}
              onChange={(event) => updatePreference("quietHoursStart", event.target.value)}
              type="time"
              disabled={isBusy}
            />
          </label>
          <label className="vh-admin-form-field">
            <span>Quiet Hours End</span>
            <input
              value={settings.preferences.quietHoursEnd}
              onChange={(event) => updatePreference("quietHoursEnd", event.target.value)}
              type="time"
              disabled={isBusy}
            />
          </label>
        </div>
        <div className="vh-admin-toggle-row">
          <span>
            <strong>Quiet Hours</strong>
            <small>Delay non-urgent notifications during the selected hours.</small>
          </span>
          <ToggleButton
            label={`${settings.preferences.quietHoursEnabled ? "Disable" : "Enable"} quiet hours`}
            checked={settings.preferences.quietHoursEnabled}
            disabled={isBusy}
            onToggle={() => updatePreference("quietHoursEnabled", !settings.preferences.quietHoursEnabled)}
          />
        </div>
      </section>

      <section className="vh-admin-panel vh-admin-panel--wide">
        <h2>Ecommerce Event Rules</h2>
        <p className="vh-admin-panel-copy">These rules control which real store events create email, SMS, or admin-center notifications.</p>
        <div className="vh-admin-settings-grid vh-admin-settings-grid--wide">
          {Object.entries(groups).map(([group, eventKeys]) => (
            <div className="vh-admin-panel" key={group}>
              <h2>{group}</h2>
              <div className="vh-admin-notification-rule-columns" aria-hidden="true">
                <span className="vh-admin-notification-rule-columns__spacer" />
                {(Object.keys(RULE_CHANNEL_LABELS) as NotificationChannel[]).map((channel) => (
                  <span key={channel} className={!CHANNEL_CONFIGURED[channel] ? "is-disabled" : undefined}>
                    {RULE_CHANNEL_LABELS[channel]}
                    {!CHANNEL_CONFIGURED[channel] ? " off" : ""}
                  </span>
                ))}
              </div>
              {eventKeys.map((eventKey) => {
                const definition = NOTIFICATION_EVENT_DEFINITIONS[eventKey];
                return (
                  <div className="vh-admin-toggle-row vh-admin-toggle-row--notification-rule" key={eventKey}>
                    <span>
                      <strong>{definition.label}</strong>
                      <small>{definition.description}</small>
                    </span>
                    <span className="vh-admin-notification-rule-switches">
                      {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((channel) => (
                        <span
                          className="vh-admin-notification-rule-switch"
                          data-label={RULE_CHANNEL_LABELS[channel]}
                          key={channel}
                        >
                          <ToggleButton
                            label={`${definition.label} ${RULE_CHANNEL_LABELS[channel]}`}
                            checked={CHANNEL_CONFIGURED[channel] && settings.rules[eventKey][channel]}
                            disabled={isBusy || !CHANNEL_CONFIGURED[channel] || !settings.channels[channel]}
                            onToggle={() => updateRule(eventKey, channel, !settings.rules[eventKey][channel])}
                          />
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="vh-admin-panel vh-admin-panel--wide">
        <h2>Notification History</h2>
        <p className="vh-admin-panel-copy">Recent notification records created from real store events.</p>
        {historyRows.length ? (
          <div className="vh-admin-notification-history">
            {historyRows.map((row) => (
              <article className="vh-admin-notification-history__item" key={row.id}>
                <span className="vh-admin-notification-history__meta">
                  <strong>{row.channel.toUpperCase()}</strong>
                  <i>{row.status}</i>
                  <small>{formatNotificationDate(row.createdAt)}</small>
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.type}</small>
                  <p>{row.message}</p>
                  {row.errorMessage ? <em>{row.errorMessage}</em> : null}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="vh-admin-empty-inline">
            <strong>No notification records yet.</strong>
            <p>Order, payment, inventory, customer, and security events will appear here once triggered.</p>
          </div>
        )}
      </section>

      {status === "saving" ? <p className="vh-admin-panel-copy vh-admin-panel--wide">Saving notification settings...</p> : null}
      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit" disabled={isBusy}>
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Save Changes</span>
      </button>
    </form>
  );
}
