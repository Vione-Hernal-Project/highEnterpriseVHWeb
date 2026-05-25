import Link from "next/link";
import {
  Bell,
  CreditCard,
  DollarSign,
  Mail,
  MapPin,
  ReceiptText,
  Save,
  Settings,
  Store,
  Truck,
} from "lucide-react";

import { AdminGeneralSettingsForm, AdminGeneralSettingsSaveButton } from "@/components/admin/admin-general-settings-form";
import { AdminEmailSettingsForm, AdminEmailSettingsSaveButton } from "@/components/admin/admin-email-settings-form";
import { AdminLocationSettings, AdminLocationSettingsSaveButton } from "@/components/admin/admin-location-settings";
import { AdminNotificationSettingsForm, AdminNotificationSettingsSaveButton } from "@/components/admin/admin-notification-settings-form";
import { AdminPaymentMethodSettingsForm, AdminPaymentMethodSettingsSaveButton } from "@/components/admin/admin-payment-method-settings-form";
import { AdminShippingSettingsForm, AdminShippingSettingsSaveButton } from "@/components/admin/admin-shipping-settings-form";
import { AdminTaxSettingsForm, AdminTaxSettingsSaveButton } from "@/components/admin/admin-tax-settings-form";
import { AdminActionButton, AdminPageHeader, AdminStatCard } from "@/components/admin/admin-ui";
import {
  loadAdminNotificationHistoryRows,
  loadAdminNotificationSettings,
  type AdminNotificationHistoryItem,
} from "@/lib/admin/notifications";
import { loadAdminGeneralSettings, type AdminGeneralSettings } from "@/lib/admin/settings";
import type { AdminNotificationSettings } from "@/lib/notifications/definitions";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { href: "/admin/settings", key: "general", label: "General", icon: Settings },
  { href: "/admin/settings/store-information", key: "store-information", label: "Store Information", icon: Store },
  { href: "/admin/settings/location", key: "location", label: "Location", icon: MapPin },
  { href: "/admin/settings/currency", key: "currency", label: "Currency", icon: DollarSign },
  { href: "/admin/settings/tax", key: "tax", label: "Tax", icon: ReceiptText },
  { href: "/admin/settings/shipping", key: "shipping", label: "Shipping", icon: Truck },
  { href: "/admin/settings/payment-methods", key: "payment-methods", label: "Payment Methods", icon: CreditCard },
  { href: "/admin/settings/email", key: "email", label: "Email", icon: Mail },
  { href: "/admin/settings/notifications", key: "notifications", label: "Notifications", icon: Bell },
];

type Props = {
  section?: string;
};

function titleForSection(section: string) {
  return SETTINGS_NAV.find((item) => item.key === section)?.label || "Settings";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="vh-admin-form-field">
      <span>{label}</span>
      <input defaultValue={value} />
    </label>
  );
}

function ToggleRow({ label, copy, enabled = true }: { label: string; copy: string; enabled?: boolean }) {
  return (
    <div className="vh-admin-toggle-row">
      <span><strong>{label}</strong><small>{copy}</small></span>
      <button className={cn("vh-admin-toggle", enabled && "vh-admin-toggle--on")} type="button" aria-label={label}>
        <i />
      </button>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="vh-admin-settings-grid">
      <section className="vh-admin-panel">
        <h2>Store Information</h2>
        <div className="vh-admin-form-grid">
          <Field label="Store Name" value="Vione Hernal" />
          <Field label="Tagline" value="Elegance in every stitch" />
          <Field label="Store Email" value="support@vionehernal.com" />
          <Field label="Phone Number" value="+1 234 567 8900" />
        </div>
      </section>
      <section className="vh-admin-panel">
        <h2>Currency Settings</h2>
        <div className="vh-admin-form-grid">
          <Field label="Default Currency" value="Philippine Peso (PHP)" />
          <Field label="Currency Position" value="Left (₱100.00)" />
          <Field label="Thousand Separator" value="," />
          <Field label="Number of Decimals" value="2" />
        </div>
      </section>
      <section className="vh-admin-panel">
        <h2>Other Settings</h2>
        <ToggleRow label="Enable Store" copy="Make your store visible to customers" />
        <ToggleRow label="Allow Customer Registration" copy="Allow customers to create an account" />
        <ToggleRow label="Enable Reviews" copy="Allow customers to write product reviews" />
        <ToggleRow label="Enable Wishlist" copy="Allow customers to add products to wishlist" enabled={false} />
      </section>
      <section className="vh-admin-panel">
        <h2>Time Settings</h2>
        <div className="vh-admin-form-grid">
          <Field label="Timezone" value="(GMT+08:00) Asia/Manila" />
          <Field label="Date Format" value="May 22, 2024" />
          <Field label="Time Format" value="10:30 AM" />
        </div>
      </section>
    </div>
  );
}

function StoreInformation({ settings }: { settings: AdminGeneralSettings }) {
  return (
    <div className="vh-admin-settings-grid vh-admin-settings-grid--wide">
      <section className="vh-admin-panel">
        <h2>Basic Information</h2>
        <div className="vh-admin-form-grid">
          <Field label="Store Name" value={settings.storeName} />
          <Field label="Store URL" value="https://www.vionehernal.com" />
          <Field label="Tagline" value={settings.tagline} />
          <Field label="Business Type" value="Fashion & Apparel" />
          <Field label="Store Email" value={settings.storeEmail} />
          <Field label="Year Established" value="2026" />
        </div>
      </section>
      <section className="vh-admin-panel">
        <h2>Store Logo</h2>
        <div className="vh-admin-logo-preview">
          <img src={settings.logoUrl || "/assets/images/vh-logo-v2.jpg"} alt="Vione Hernal logo" />
          <small>Manage the active logo and favicon from General settings.</small>
        </div>
      </section>
      <section className="vh-admin-panel vh-admin-panel--wide">
        <h2>Store Description</h2>
        <textarea className="vh-admin-textarea" defaultValue="Welcome to Vione Hernal, where elegance meets style." />
      </section>
    </div>
  );
}

function CurrencySettings() {
  return (
    <div className="vh-admin-settings-grid vh-admin-settings-grid--wide">
      <section className="vh-admin-panel">
        <h2>Primary Currency</h2>
        <div className="vh-admin-form-grid">
          <Field label="Default Currency" value="Philippine Peso (PHP)" />
          <Field label="Currency Position" value="Left (₱100.00)" />
          <Field label="Number of Decimals" value="2" />
          <Field label="Thousand Separator" value="," />
        </div>
      </section>
      <section className="vh-admin-panel vh-admin-preview-card"><span>Preview</span><strong>₱1,234.56</strong><p>Order Total ₱2,469.12</p></section>
    </div>
  );
}

function renderSection(
  section: string,
  generalSettings: AdminGeneralSettings | null,
  notificationSettings: AdminNotificationSettings | null,
  notificationHistoryRows: AdminNotificationHistoryItem[],
) {
  if (section === "store-information") return generalSettings ? <StoreInformation settings={generalSettings} /> : null;
  if (section === "location") return generalSettings ? <AdminLocationSettings initialSettings={generalSettings} /> : null;
  if (section === "currency") return <CurrencySettings />;
  if (section === "tax") return generalSettings ? <AdminTaxSettingsForm initialSettings={generalSettings} /> : null;
  if (section === "shipping") return generalSettings ? <AdminShippingSettingsForm initialSettings={generalSettings} /> : null;
  if (section === "payment-methods") return generalSettings ? <AdminPaymentMethodSettingsForm initialSettings={generalSettings} /> : null;
  if (section === "email") return generalSettings ? <AdminEmailSettingsForm initialSettings={generalSettings} /> : null;
  if (section === "notifications") {
    return notificationSettings ? (
      <AdminNotificationSettingsForm initialSettings={notificationSettings} historyRows={notificationHistoryRows} />
    ) : null;
  }
  return <GeneralSettings />;
}

export async function AdminSettingsView({ section = "general" }: Props) {
  const normalizedSection = SETTINGS_NAV.some((item) => item.key === section) ? section : "general";
  const generalSettings = ["general", "store-information", "location", "tax", "shipping", "payment-methods", "email"].includes(normalizedSection)
    ? await loadAdminGeneralSettings()
    : null;
  const notificationSettings = normalizedSection === "notifications" ? await loadAdminNotificationSettings() : null;
  const notificationHistoryRows = normalizedSection === "notifications" ? await loadAdminNotificationHistoryRows() : [];

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={titleForSection(normalizedSection)} subtitle="Manage your store settings and preferences.">
        {normalizedSection === "general" && generalSettings ? (
          <AdminGeneralSettingsSaveButton />
        ) : normalizedSection === "location" && generalSettings ? (
          <AdminLocationSettingsSaveButton />
        ) : normalizedSection === "tax" && generalSettings ? (
          <AdminTaxSettingsSaveButton />
        ) : normalizedSection === "shipping" && generalSettings ? (
          <AdminShippingSettingsSaveButton />
        ) : normalizedSection === "payment-methods" && generalSettings ? (
          <AdminPaymentMethodSettingsSaveButton />
        ) : normalizedSection === "email" && generalSettings ? (
          <AdminEmailSettingsSaveButton />
        ) : normalizedSection === "notifications" && notificationSettings ? (
          <AdminNotificationSettingsSaveButton />
        ) : (
          <AdminActionButton icon={Save} variant="primary">Save Changes</AdminActionButton>
        )}
      </AdminPageHeader>

      <div className="vh-admin-settings-layout">
        <aside className="vh-admin-settings-menu">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href} className={cn(item.key === normalizedSection && "vh-admin-settings-menu__active")}>
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </aside>
        <div className="vh-admin-settings-content">
          {normalizedSection === "general" && generalSettings ? (
            <AdminGeneralSettingsForm initialSettings={generalSettings} />
          ) : (
            renderSection(normalizedSection, generalSettings, notificationSettings, notificationHistoryRows)
          )}
        </div>
      </div>
    </div>
  );
}
