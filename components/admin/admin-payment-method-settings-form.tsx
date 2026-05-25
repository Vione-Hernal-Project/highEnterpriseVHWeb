"use client";

import { useState, type FormEvent } from "react";
import { CreditCard, ReceiptText, Save, Settings } from "lucide-react";

import { AdminStatCard, AdminStatusBadge } from "@/components/admin/admin-ui";
import { broadcastCheckoutSettingsUpdate } from "@/lib/checkout-settings-sync";
import { PAYMENT_METHOD_AVAILABILITY_OPTIONS } from "@/lib/checkout-availability";
import type { AdminGeneralSettings } from "@/lib/admin/settings";
import { readJsonSafely } from "@/lib/http";
import { cn } from "@/lib/utils";

const PAYMENT_SETTINGS_FORM_ID = "vh-admin-payment-method-settings-form";

type Props = {
  initialSettings: AdminGeneralSettings;
};

function getPaymentSettingsKey(settings: AdminGeneralSettings) {
  return PAYMENT_METHOD_AVAILABILITY_OPTIONS.map((option) => `${option.value}:${settings[option.settingsKey] ? "1" : "0"}`).join("|");
}

export function AdminPaymentMethodSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form={PAYMENT_SETTINGS_FORM_ID}>
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminPaymentMethodSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettingsKey, setSavedSettingsKey] = useState(() => getPaymentSettingsKey(initialSettings));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const activeMethodCount = PAYMENT_METHOD_AVAILABILITY_OPTIONS.filter((option) => settings[option.settingsKey]).length;
  const hasUnsavedChanges = getPaymentSettingsKey(settings) !== savedSettingsKey;

  function update(key: keyof AdminGeneralSettings, value: boolean) {
    setSettings((currentSettings) => ({ ...currentSettings, [key]: value }));
    setStatus("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await readJsonSafely<{ error?: string; settings?: AdminGeneralSettings }>(response);

      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error || "Unable to save payment method settings.");
      }

      setSettings(payload.settings);
      setSavedSettingsKey(getPaymentSettingsKey(payload.settings));
      setStatus("saved");
      setMessage("Payment method settings saved.");
      broadcastCheckoutSettingsUpdate();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save payment method settings.");
    }
  }

  return (
    <form id={PAYMENT_SETTINGS_FORM_ID} className="vh-admin-tax-settings-form" onSubmit={handleSubmit}>
      {message ? (
        <div className={cn("vh-admin-form-alert", status === "error" && "vh-admin-form-alert--error")} role="status">
          {message}
        </div>
      ) : null}
      {hasUnsavedChanges && status !== "saving" && status !== "saved" ? (
        <div className="vh-admin-form-alert vh-admin-form-alert--warning" role="status">
          Payment method changes are not saved yet. Click Save Changes before checking checkout.
        </div>
      ) : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four">
        <AdminStatCard label="Payment Status" value={activeMethodCount ? "Enabled" : "Disabled"} delta={activeMethodCount ? "Payments are active" : "No active methods"} icon={CreditCard} />
        <AdminStatCard label="Active Methods" value={activeMethodCount} delta="Crypto rails enabled" tone="blue" icon={CreditCard} />
        <AdminStatCard label="Default Method" value="Customer Choice" delta="No forced default" tone="gold" icon={Settings} />
        <AdminStatCard label="Transactions" value="Live" delta="Via ledger records" tone="purple" icon={ReceiptText} />
      </section>

      <section className="vh-admin-panel">
        <h2>Payment Methods</h2>
        <p className="vh-admin-panel-copy">Disabled methods are hidden from checkout and rejected by server-side quote/order validation.</p>
        <div className="vh-admin-payment-methods">
          {PAYMENT_METHOD_AVAILABILITY_OPTIONS.map((option) => {
            const enabled = Boolean(settings[option.settingsKey]);

            return (
              <div key={option.value}>
                <span>
                  <strong>{option.label}</strong>
                  <small>{enabled ? "Available in checkout" : "Hidden from checkout"}</small>
                </span>
                <div className="vh-admin-payment-methods__controls">
                  <AdminStatusBadge tone={enabled ? "active" : "inactive"}>{enabled ? "Active" : "Inactive"}</AdminStatusBadge>
                  <button
                    className={cn("vh-admin-toggle", enabled && "vh-admin-toggle--on")}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${option.label}`}
                    onClick={() => update(option.settingsKey, !enabled)}
                    disabled={status === "saving"}
                  >
                    <i />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {status === "saving" ? <p className="vh-admin-panel-copy">Saving payment method settings...</p> : null}
      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit">
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Save Changes</span>
      </button>
    </form>
  );
}
