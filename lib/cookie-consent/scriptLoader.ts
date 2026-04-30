"use client";

import {
  defaultCookieConsentPreferences,
  getStoredCookieConsent,
  type CookieConsentCategory,
  type CookieConsentPreferences,
  type StoredCookieConsent,
} from "@/lib/cookie-consent/consentStorage";

declare global {
  interface Window {
    canLoadTracking?: (category: CookieConsentCategory) => boolean;
    getCookieConsent?: () => StoredCookieConsent | null;
    loadTrackingScript?: (src: string, category: CookieConsentCategory, attributes?: Record<string, string>) => Promise<HTMLScriptElement | null>;
    gtag?: (...args: unknown[]) => void;
  }
}

function getPreferences(): CookieConsentPreferences {
  return getStoredCookieConsent()?.preferences ?? defaultCookieConsentPreferences;
}

export function getCookieConsent() {
  return getStoredCookieConsent();
}

export function canLoadTracking(category: CookieConsentCategory) {
  if (category === "essential") {
    return true;
  }

  return Boolean(getPreferences()[category]);
}

export function updateGoogleConsentMode() {
  const preferences = getPreferences();

  window.gtag?.("consent", "update", {
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_storage: preferences.marketing ? "granted" : "denied",
    ad_user_data: preferences.marketing ? "granted" : "denied",
    ad_personalization: preferences.marketing ? "granted" : "denied",
  });
}

export function loadTrackingScript(src: string, category: CookieConsentCategory, attributes: Record<string, string> = {}) {
  if (!canLoadTracking(category)) {
    return Promise.resolve(null);
  }

  return new Promise<HTMLScriptElement>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

    if (existingScript) {
      resolve(existingScript);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    Object.entries(attributes).forEach(([name, value]) => {
      script.setAttribute(name, value);
    });

    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load tracking script: ${src}`)), { once: true });

    document.head.appendChild(script);
  });
}

export function exposeCookieConsentGlobals() {
  window.getCookieConsent = getCookieConsent;
  window.canLoadTracking = canLoadTracking;
  window.loadTrackingScript = loadTrackingScript;
  updateGoogleConsentMode();
}

