"use client";

export type CookieConsentCategory = "essential" | "analytics" | "marketing";

export type CookieConsentPreferences = Record<CookieConsentCategory, boolean>;

export type StoredCookieConsent = {
  preferences: CookieConsentPreferences;
  savedAt: string;
  expiresAt: string;
  version: 1;
};

const CONSENT_STORAGE_KEY = "vh_cookie_consent";
const CONSENT_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export const defaultCookieConsentPreferences: CookieConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizePreferences(value: Partial<CookieConsentPreferences> | null | undefined): CookieConsentPreferences {
  return {
    essential: true,
    analytics: Boolean(value?.analytics),
    marketing: Boolean(value?.marketing),
  };
}

function isStoredCookieConsent(value: unknown): value is StoredCookieConsent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredCookieConsent>;

  return Boolean(candidate.preferences && candidate.savedAt && candidate.expiresAt && candidate.version === 1);
}

export function getStoredCookieConsent(): StoredCookieConsent | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);

    if (!rawConsent) {
      return null;
    }

    const parsed = JSON.parse(rawConsent) as unknown;

    if (!isStoredCookieConsent(parsed) || Date.parse(parsed.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      return null;
    }

    return {
      ...parsed,
      preferences: normalizePreferences(parsed.preferences),
    };
  } catch {
    return null;
  }
}

export function saveCookieConsent(preferences: Partial<CookieConsentPreferences>): StoredCookieConsent | null {
  if (!isBrowser()) {
    return null;
  }

  const savedAt = new Date();
  const consent: StoredCookieConsent = {
    preferences: normalizePreferences(preferences),
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + CONSENT_DURATION_MS).toISOString(),
    version: 1,
  };

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent("vh-cookie-consent-updated", { detail: consent }));
  } catch {
    return null;
  }

  return consent;
}

export function clearCookieConsent() {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new Event("vh-cookie-consent-cleared"));
  } catch {
    // localStorage may be unavailable in private or locked-down browser modes.
  }
}

