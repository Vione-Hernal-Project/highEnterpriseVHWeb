"use client";

import { MapPin, ReceiptText, Save, Settings } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { AdminStatCard } from "@/components/admin/admin-ui";
import type { AdminGeneralSettings } from "@/lib/admin/settings";
import { broadcastCheckoutSettingsUpdate } from "@/lib/checkout-settings-sync";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { getActiveTaxRule, getActiveTaxRuleCount, getTaxRuleEnabled, TAX_RULES, type ActiveTaxRule } from "@/lib/tax";

type Props = {
  initialSettings: AdminGeneralSettings;
};

function TaxToggleRow({
  rule,
  enabled,
  onChange,
}: {
  rule: ActiveTaxRule;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="vh-admin-toggle-row">
      <span>
        <strong>{rule.label.replace(` ${rule.ratePercent}%`, "")}</strong>
        <small>{rule.ratePercent}% · {enabled ? "Active for checkout totals" : "Inactive, not applied to orders"}</small>
      </span>
      <button
        className={`vh-admin-toggle${enabled ? " vh-admin-toggle--on" : ""}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${rule.label}`}
        onClick={() => onChange(!enabled)}
      >
        <i />
      </button>
    </div>
  );
}

function normalizeExclusiveTaxSettings(settings: AdminGeneralSettings): AdminGeneralSettings {
  const activeRule = getActiveTaxRule(settings);

  return {
    ...settings,
    vat12Enabled: activeRule?.id === "vat12",
    reducedVat5Enabled: activeRule?.id === "reducedVat5",
    zeroRatedVat0Enabled: activeRule?.id === "zeroRatedVat0",
  };
}

function getTaxSettingsKey(settings: AdminGeneralSettings) {
  return [
    settings.vat12Enabled ? "vat12" : "",
    settings.reducedVat5Enabled ? "reducedVat5" : "",
    settings.zeroRatedVat0Enabled ? "zeroRatedVat0" : "",
  ].join("|");
}

export function AdminTaxSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form="vh-admin-tax-settings-form">
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

export function AdminTaxSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(() => normalizeExclusiveTaxSettings(initialSettings));
  const [savedSettingsKey, setSavedSettingsKey] = useState(() => getTaxSettingsKey(normalizeExclusiveTaxSettings(initialSettings)));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const activeRule = useMemo(() => getActiveTaxRule(settings), [settings]);
  const activeRuleCount = useMemo(() => getActiveTaxRuleCount(settings), [settings]);
  const hasUnsavedChanges = getTaxSettingsKey(settings) !== savedSettingsKey;

  function updateRule(ruleId: ActiveTaxRule["id"], enabled: boolean) {
    setSettings((current) => ({
      ...current,
      vat12Enabled: enabled && ruleId === "vat12",
      reducedVat5Enabled: enabled && ruleId === "reducedVat5",
      zeroRatedVat0Enabled: enabled && ruleId === "zeroRatedVat0",
    }));
    setStatus("idle");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/admin/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await readJsonSafely<{ error?: string; settings?: AdminGeneralSettings }>(response);

      if (!response.ok || !payload?.settings) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save tax settings."));
      }

      setSettings(payload.settings);
      setSavedSettingsKey(getTaxSettingsKey(payload.settings));
      setStatus("saved");
      broadcastCheckoutSettingsUpdate();
    } catch (saveError) {
      setStatus("idle");
      setError(getErrorMessage(saveError, "Unable to save tax settings."));
    }
  }

  return (
    <form id="vh-admin-tax-settings-form" className="vh-admin-tax-settings-form" onSubmit={handleSubmit}>
      {error ? <div className="vh-admin-form-alert vh-admin-form-alert--error">{error}</div> : null}
      {status === "saved" ? <div className="vh-admin-form-alert">Tax settings saved.</div> : null}
      {hasUnsavedChanges && status !== "saving" && status !== "saved" ? (
        <div className="vh-admin-form-alert vh-admin-form-alert--warning">
          Tax changes are not saved yet. Click Save Changes before checking checkout.
        </div>
      ) : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four">
        <AdminStatCard
          label="Default Tax Rate"
          value={activeRule ? `${activeRule.ratePercent}%` : "0%"}
          delta={activeRule ? `${activeRule.label} applied` : "No VAT applied"}
          icon={ReceiptText}
        />
        <AdminStatCard
          label="Tax Status"
          value={activeRule ? "Enabled" : "Disabled"}
          delta={activeRule ? "Taxes are active" : "Checkout tax is off"}
          tone="green"
          icon={ReceiptText}
        />
        <AdminStatCard label="Tax Region" value="Philippines" delta="Based on location" tone="blue" icon={MapPin} />
        <AdminStatCard label="Tax Rules" value={activeRuleCount} delta={`${activeRuleCount} active tax rule${activeRuleCount === 1 ? "" : "s"}`} tone="gold" icon={Settings} />
      </section>

      <section className="vh-admin-panel">
        <h2>Tax Rates</h2>
        <p className="vh-admin-panel-copy">Choose the single VAT rule that should be applied to checkout totals and customer order summaries.</p>
        <div className="vh-admin-kpi-list">
          {TAX_RULES.map((rule) => (
            <TaxToggleRow key={rule.id} rule={rule} enabled={getTaxRuleEnabled(settings, rule.id)} onChange={(enabled) => updateRule(rule.id, enabled)} />
          ))}
        </div>
      </section>

      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit" disabled={status === "saving"}>
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>{status === "saving" ? "Saving..." : "Save Changes"}</span>
      </button>
    </form>
  );
}
