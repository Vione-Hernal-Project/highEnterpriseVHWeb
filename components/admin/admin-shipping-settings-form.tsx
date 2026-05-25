"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Package, Save, Truck } from "lucide-react";

import { AdminStatCard } from "@/components/admin/admin-ui";
import { broadcastCheckoutSettingsUpdate } from "@/lib/checkout-settings-sync";
import { readJsonSafely } from "@/lib/http";
import type { AdminGeneralSettings } from "@/lib/admin/settings";
import { SHIPPING_ZONE_AVAILABILITY_OPTIONS } from "@/lib/checkout-availability";
import { cn } from "@/lib/utils";

const SHIPPING_SETTINGS_FORM_ID = "vh-admin-shipping-settings-form";

type Props = {
  initialSettings: AdminGeneralSettings;
};

function getShippingSettingsKey(settings: AdminGeneralSettings) {
  return SHIPPING_ZONE_AVAILABILITY_OPTIONS.map((option) => `${option.code}:${settings[option.settingsKey] ? "1" : "0"}`).join("|");
}

export function AdminShippingSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form={SHIPPING_SETTINGS_FORM_ID}>
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminShippingSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettingsKey, setSavedSettingsKey] = useState(() => getShippingSettingsKey(initialSettings));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const activeZoneCount = SHIPPING_ZONE_AVAILABILITY_OPTIONS.filter((option) => settings[option.settingsKey]).length;
  const hasUnsavedChanges = getShippingSettingsKey(settings) !== savedSettingsKey;

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
        throw new Error(payload?.error || "Unable to save shipping settings.");
      }

      setSettings(payload.settings);
      setSavedSettingsKey(getShippingSettingsKey(payload.settings));
      setStatus("saved");
      setMessage("Shipping settings saved.");
      broadcastCheckoutSettingsUpdate();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save shipping settings.");
    }
  }

  return (
    <form id={SHIPPING_SETTINGS_FORM_ID} className="vh-admin-tax-settings-form" onSubmit={handleSubmit}>
      {message ? (
        <div className={cn("vh-admin-form-alert", status === "error" && "vh-admin-form-alert--error")} role="status">
          {message}
        </div>
      ) : null}
      {hasUnsavedChanges && status !== "saving" && status !== "saved" ? (
        <div className="vh-admin-form-alert vh-admin-form-alert--warning" role="status">
          Shipping changes are not saved yet. Click Save Changes before checking checkout.
        </div>
      ) : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four">
        <AdminStatCard label="Shipping Status" value={activeZoneCount ? "Enabled" : "Disabled"} delta={activeZoneCount ? "Shipping is active" : "No active zones"} icon={Truck} />
        <AdminStatCard label="Active Zones" value={activeZoneCount} delta="Enabled delivery regions" tone="blue" icon={MapPin} />
        <AdminStatCard label="Shipping Methods" value={activeZoneCount * 2} delta="Standard + express per zone" tone="green" icon={Package} />
        <AdminStatCard label="Free Shipping" value="Enabled" delta="Available for qualified orders" tone="rose" icon={Truck} />
      </section>

      <section className="vh-admin-panel">
        <h2>Shipping Zones</h2>
        <p className="vh-admin-panel-copy">Only enabled zones are allowed during customer checkout. Philippines is active by default.</p>
        <div className="vh-admin-kpi-list">
          {SHIPPING_ZONE_AVAILABILITY_OPTIONS.map((option) => {
            const enabled = Boolean(settings[option.settingsKey]);

            return (
              <div key={option.code} className="vh-admin-toggle-row">
                <span>
                  <strong>{option.label}</strong>
                  <small>{enabled ? "Active in checkout" : "Hidden from checkout"}</small>
                </span>
                <button
                  className={cn("vh-admin-toggle", enabled && "vh-admin-toggle--on")}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${option.label} shipping`}
                  onClick={() => update(option.settingsKey, !enabled)}
                  disabled={status === "saving"}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {status === "saving" ? <p className="vh-admin-panel-copy">Saving shipping settings...</p> : null}
      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit">
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Save Changes</span>
      </button>
    </form>
  );
}
