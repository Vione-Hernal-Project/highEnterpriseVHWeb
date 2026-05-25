export type CheckoutAttribution = {
  source?: string;
  medium?: string;
  campaignId?: string;
  campaignName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const ATTRIBUTION_STORAGE_KEY = "vh_marketing_attribution";

function cleanValue(value: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const attribution: CheckoutAttribution = {
    source: cleanValue(params.get("source")),
    medium: cleanValue(params.get("medium")),
    campaignId: cleanValue(params.get("campaign_id")),
    campaignName: cleanValue(params.get("campaign_name")),
    utmSource: cleanValue(params.get("utm_source")),
    utmMedium: cleanValue(params.get("utm_medium")),
    utmCampaign: cleanValue(params.get("utm_campaign")),
  };

  const hasAttribution = Object.values(attribution).some(Boolean);

  if (!hasAttribution || !canUseStorage()) {
    return null;
  }

  window.sessionStorage.setItem(
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify({
      ...attribution,
      capturedAt: new Date().toISOString(),
      landingPage: window.location.pathname,
    }),
  );

  return attribution;
}

export function readMarketingAttribution(): CheckoutAttribution | null {
  if (!canUseStorage()) {
    return null;
  }

  captureMarketingAttribution();

  const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CheckoutAttribution;
    const attribution: CheckoutAttribution = {
      source: cleanValue(parsed.source || null),
      medium: cleanValue(parsed.medium || null),
      campaignId: cleanValue(parsed.campaignId || null),
      campaignName: cleanValue(parsed.campaignName || null),
      utmSource: cleanValue(parsed.utmSource || null),
      utmMedium: cleanValue(parsed.utmMedium || null),
      utmCampaign: cleanValue(parsed.utmCampaign || null),
    };

    return Object.values(attribution).some(Boolean) ? attribution : null;
  } catch {
    window.sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    return null;
  }
}
