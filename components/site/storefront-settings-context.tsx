"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { StorefrontPublicSettings } from "@/lib/storefront/settings-live-sync";

export type { StorefrontPublicSettings };

const DEFAULT_STOREFRONT_SETTINGS: StorefrontPublicSettings = {
  storeName: "Vione Hernal",
  storeEmail: "support@vionehernal.com",
  enableStore: true,
  allowCustomerRegistration: true,
  enableReviews: true,
  enableWishlist: false,
};

const StorefrontSettingsContext = createContext<StorefrontPublicSettings>(DEFAULT_STOREFRONT_SETTINGS);

export function StorefrontSettingsProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: StorefrontPublicSettings;
}) {
  return (
    <StorefrontSettingsContext.Provider value={settings}>
      {children}
    </StorefrontSettingsContext.Provider>
  );
}

export function useStorefrontSettings() {
  return useContext(StorefrontSettingsContext);
}
