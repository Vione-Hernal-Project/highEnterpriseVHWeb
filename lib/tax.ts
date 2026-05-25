export type TaxSettingsLike = {
  vat12Enabled?: boolean;
  reducedVat5Enabled?: boolean;
  zeroRatedVat0Enabled?: boolean;
};

export type ActiveTaxRule = {
  id: "vat12" | "reducedVat5" | "zeroRatedVat0";
  label: string;
  ratePercent: number;
};

export const TAX_RULES: ActiveTaxRule[] = [
  { id: "vat12", label: "VAT 12%", ratePercent: 12 },
  { id: "reducedVat5", label: "Reduced VAT 5%", ratePercent: 5 },
  { id: "zeroRatedVat0", label: "Zero Rated 0%", ratePercent: 0 },
];

export function getTaxRuleEnabled(settings: TaxSettingsLike, ruleId: ActiveTaxRule["id"]) {
  if (ruleId === "vat12") {
    return settings.vat12Enabled === true;
  }

  if (ruleId === "reducedVat5") {
    return settings.reducedVat5Enabled === true;
  }

  return settings.zeroRatedVat0Enabled === true;
}

export function getActiveTaxRule(settings: TaxSettingsLike): ActiveTaxRule | null {
  return TAX_RULES.find((rule) => getTaxRuleEnabled(settings, rule.id)) || null;
}

export function getActiveTaxRuleCount(settings: TaxSettingsLike) {
  return TAX_RULES.filter((rule) => getTaxRuleEnabled(settings, rule.id)).length;
}
