export type StorefrontPublicSettings = {
  storeName: string;
  storeEmail: string;
  enableStore: boolean;
  allowCustomerRegistration: boolean;
  enableReviews: boolean;
  enableWishlist: boolean;
};

const STOREFRONT_SETTINGS_EVENT = "vionehernal-storefront-settings";
const STOREFRONT_SETTINGS_STORAGE_KEY = "vionehernal_storefront_settings";

type StorefrontSettingsPayload = {
  settings: StorefrontPublicSettings;
  updatedAt: number;
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function isStorefrontPublicSettings(value: unknown): value is StorefrontPublicSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Partial<StorefrontPublicSettings>;

  return (
    typeof settings.storeName === "string" &&
    typeof settings.storeEmail === "string" &&
    typeof settings.enableStore === "boolean" &&
    typeof settings.allowCustomerRegistration === "boolean" &&
    typeof settings.enableReviews === "boolean" &&
    typeof settings.enableWishlist === "boolean"
  );
}

function readPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<StorefrontSettingsPayload>;

  return isStorefrontPublicSettings(payload.settings) ? payload.settings : null;
}

function readStoredPayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return readPayload(JSON.parse(value));
  } catch {
    return null;
  }
}

export function broadcastStorefrontSettings(settings: StorefrontPublicSettings) {
  if (!canUseWindow()) {
    return;
  }

  const payload: StorefrontSettingsPayload = {
    settings,
    updatedAt: Date.now(),
  };

  window.dispatchEvent(new CustomEvent(STOREFRONT_SETTINGS_EVENT, { detail: payload }));

  try {
    window.localStorage.setItem(STOREFRONT_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; BroadcastChannel is attempted below.
  }

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(STOREFRONT_SETTINGS_EVENT);
    channel.postMessage(payload);
    channel.close();
  }
}

export function subscribeToStorefrontSettings(callback: (settings: StorefrontPublicSettings) => void) {
  if (!canUseWindow()) {
    return () => undefined;
  }

  const handleSettings = (settings: StorefrontPublicSettings | null) => {
    if (settings) {
      callback(settings);
    }
  };
  const handleWindowEvent = (event: Event) => {
    handleSettings(readPayload((event as CustomEvent<StorefrontSettingsPayload>).detail));
  };
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STOREFRONT_SETTINGS_STORAGE_KEY) {
      handleSettings(readStoredPayload(event.newValue));
    }
  };
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(STOREFRONT_SETTINGS_EVENT) : null;

  if (channel) {
    channel.onmessage = (event) => {
      handleSettings(readPayload(event.data));
    };
  }

  window.addEventListener(STOREFRONT_SETTINGS_EVENT, handleWindowEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(STOREFRONT_SETTINGS_EVENT, handleWindowEvent);
    window.removeEventListener("storage", handleStorageEvent);
    channel?.close();
  };
}

export async function fetchLiveStorefrontSettings() {
  const response = await fetch("/api/settings/storefront", { cache: "no-store" }).catch(() => null);
  const payload = response?.ok
    ? ((await response.json().catch(() => null)) as { settings?: unknown } | null)
    : null;

  return isStorefrontPublicSettings(payload?.settings) ? payload.settings : null;
}
