"use client";

import { Save } from "lucide-react";
import { ChangeEvent, FormEvent, useRef, useState, type ReactNode } from "react";

import { BRANDING_UPDATED_EVENT } from "@/components/branding/branding-assets";
import type { AdminGeneralSettings } from "@/lib/admin/settings";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type Props = {
  initialSettings: AdminGeneralSettings;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  as = "input",
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  as?: "input" | "textarea" | "select";
  children?: ReactNode;
}) {
  return (
    <label className="vh-admin-form-field">
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : as === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function ToggleRow({
  label,
  copy,
  enabled,
  onChange,
}: {
  label: string;
  copy: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="vh-admin-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{copy}</small>
      </span>
      <button
        className={`vh-admin-toggle${enabled ? " vh-admin-toggle--on" : ""}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
      >
        <i />
      </button>
    </div>
  );
}

export function AdminGeneralSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form="vh-admin-general-settings-form">
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminGeneralSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const brandAssetInputRef = useRef<HTMLInputElement | null>(null);

  function update<K extends keyof AdminGeneralSettings>(key: K, value: AdminGeneralSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatus("idle");
  }

  async function saveSettings(nextSettings: AdminGeneralSettings) {
    setStatus("saving");
    setError("");

    const response = await fetch("/api/admin/settings/general", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    const payload = await readJsonSafely<{ error?: string; settings?: AdminGeneralSettings }>(response);

    if (!response.ok) {
      throw new Error(getResponseErrorMessage(payload, "Unable to save settings."));
    }

    if (payload?.settings) {
      setSettings(payload.settings);
    }

    setStatus("saved");
    window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await saveSettings(settings);
    } catch (saveError) {
      setStatus("idle");
      setError(getErrorMessage(saveError, "Unable to save settings."));
    }
  }

  async function uploadBrandingAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "logo");

      const response = await fetch("/api/admin/settings/branding/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await readJsonSafely<{ error?: string; url?: string; faviconUrl?: string; version?: string }>(response);

      if (!response.ok || !payload?.url) {
        throw new Error(getResponseErrorMessage(payload, "Unable to upload the brand asset."));
      }

      const nextSettings = {
        ...settings,
        logoUrl: payload.url,
        faviconUrl: payload.faviconUrl || payload.url,
        brandingVersion: payload.version || Date.now().toString(),
      };

      setSettings(nextSettings);
      await saveSettings(nextSettings);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Unable to upload the brand asset."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form id="vh-admin-general-settings-form" className="vh-admin-settings-grid vh-admin-general-settings-form" onSubmit={handleSubmit}>
      {error ? <div className="vh-admin-form-alert vh-admin-form-alert--error vh-admin-panel--wide">{error}</div> : null}
      {status === "saved" ? <div className="vh-admin-form-alert vh-admin-panel--wide">Settings saved.</div> : null}

      <section className="vh-admin-panel">
        <h2>Store Information</h2>
        <div className="vh-admin-form-grid">
          <Field label="Store Name" value={settings.storeName} onChange={(value) => update("storeName", value)} />
          <Field label="Tagline" value={settings.tagline} onChange={(value) => update("tagline", value)} />
          <Field label="Store Email" value={settings.storeEmail} onChange={(value) => update("storeEmail", value)} type="email" />
          <Field label="Phone Number" value={settings.phoneNumber} onChange={(value) => update("phoneNumber", value)} />
        </div>
        <div className="vh-admin-logo-preview vh-admin-logo-preview--settings">
          <img src={settings.logoUrl || "/assets/images/vh-logo-v2.jpg"} alt="Vione Hernal logo" />
          <div>
            <button type="button" onClick={() => brandAssetInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Logo / Favicon"}
            </button>
            <input ref={brandAssetInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" hidden onChange={(event) => void uploadBrandingAsset(event)} />
            <small>Updates the admin logo and browser tab icon. Square PNG or ICO works best.</small>
          </div>
        </div>
      </section>

      <section className="vh-admin-panel">
        <h2>Currency Settings</h2>
        <div className="vh-admin-form-grid">
          <Field label="Default Currency" value={settings.defaultCurrency} onChange={(value) => update("defaultCurrency", value)} as="select">
            <option value="PHP">Philippine Peso (PHP)</option>
            <option value="USD">US Dollar (USD)</option>
          </Field>
          <Field label="Currency Position" value={settings.currencyPosition} onChange={(value) => update("currencyPosition", value)} as="select">
            <option value="left">Left (₱100.00)</option>
            <option value="right">Right (100.00₱)</option>
          </Field>
          <Field label="Thousand Separator" value={settings.thousandSeparator} onChange={(value) => update("thousandSeparator", value)} />
          <Field label="Decimal Separator" value={settings.decimalSeparator} onChange={(value) => update("decimalSeparator", value)} />
          <Field label="Number of Decimals" value={settings.numberOfDecimals} onChange={(value) => update("numberOfDecimals", value)} as="select">
            <option value="0">0</option>
            <option value="2">2</option>
          </Field>
        </div>
      </section>

      <section className="vh-admin-panel">
        <h2>Email Sender Settings</h2>
        <div className="vh-admin-form-grid vh-admin-form-grid--single">
          <Field label="From Name" value={settings.fromName} onChange={(value) => update("fromName", value)} />
          <Field label="From Email" value={settings.fromEmail} onChange={(value) => update("fromEmail", value)} type="email" />
          <Field label="Reply To Email" value={settings.replyToEmail} onChange={(value) => update("replyToEmail", value)} type="email" />
          <Field label="Email Signature" value={settings.emailSignature} onChange={(value) => update("emailSignature", value)} as="textarea" />
        </div>
      </section>

      <section className="vh-admin-panel">
        <h2>Store Location</h2>
        <Field label="Store Address" value={settings.storeAddress} onChange={(value) => update("storeAddress", value)} as="textarea" />
        <div className="vh-admin-form-grid">
          <Field label="Country" value={settings.country} onChange={(value) => update("country", value)} as="select">
            <option value="Philippines">Philippines</option>
          </Field>
          <Field label="State / Province" value={settings.stateProvince} onChange={(value) => update("stateProvince", value)} />
          <Field label="City" value={settings.city} onChange={(value) => update("city", value)} />
          <Field label="Postal Code" value={settings.postalCode} onChange={(value) => update("postalCode", value)} />
        </div>
      </section>

      <section className="vh-admin-panel">
        <h2>Other Settings</h2>
        <ToggleRow label="Enable Store" copy="Make your store visible to customers" enabled={settings.enableStore} onChange={(value) => update("enableStore", value)} />
        <ToggleRow label="Allow Customer Registration" copy="Allow customers to create an account" enabled={settings.allowCustomerRegistration} onChange={(value) => update("allowCustomerRegistration", value)} />
        <ToggleRow label="Enable Reviews" copy="Allow customers to write product reviews" enabled={settings.enableReviews} onChange={(value) => update("enableReviews", value)} />
        <ToggleRow label="Enable Wishlist" copy="Allow customers to add products to wishlist" enabled={settings.enableWishlist} onChange={(value) => update("enableWishlist", value)} />
      </section>

      <section className="vh-admin-panel">
        <h2>Time Settings</h2>
        <div className="vh-admin-form-grid">
          <Field label="Timezone" value={settings.timezone} onChange={(value) => update("timezone", value)} as="select">
            <option value="Asia/Manila">(GMT+08:00) Asia/Manila</option>
            <option value="UTC">(GMT+00:00) UTC</option>
          </Field>
          <Field label="Date Format" value={settings.dateFormat} onChange={(value) => update("dateFormat", value)} as="select">
            <option value="MMM d, yyyy">May 22, 2024</option>
            <option value="yyyy-MM-dd">2024-05-22</option>
          </Field>
          <Field label="Time Format" value={settings.timeFormat} onChange={(value) => update("timeFormat", value)} as="select">
            <option value="h:mm a">10:30 AM</option>
            <option value="HH:mm">22:30</option>
          </Field>
        </div>
      </section>

      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit" disabled={status === "saving"}>
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>{status === "saving" ? "Saving..." : "Save Changes"}</span>
      </button>
    </form>
  );
}
