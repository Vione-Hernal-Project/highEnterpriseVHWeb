export const CHECKOUT_SETTINGS_SYNC_STORAGE_KEY = "vionehernal_checkout_settings_updated_at";

export function broadcastCheckoutSettingsUpdate() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHECKOUT_SETTINGS_SYNC_STORAGE_KEY, String(Date.now()));
}
