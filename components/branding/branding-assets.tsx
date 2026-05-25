"use client";

import { useEffect, useState } from "react";

type BrandingState = {
  storeName: string;
  logoUrl: string;
  faviconUrl: string;
  brandingVersion: string;
};

const FALLBACK_BRANDING: BrandingState = {
  storeName: "Vione Hernal",
  logoUrl: "/assets/images/vh-logo-v2.jpg",
  faviconUrl: "/favicon.ico",
  brandingVersion: "default",
};

export const BRANDING_UPDATED_EVENT = "vh-branding-updated";

let cachedBranding: BrandingState | null = null;

async function fetchBrandingAssets() {
  const response = await fetch("/api/settings/branding", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as Partial<BrandingState> | null;

  if (!payload) {
    return null;
  }

  return {
    storeName: payload.storeName || FALLBACK_BRANDING.storeName,
    logoUrl: payload.logoUrl || FALLBACK_BRANDING.logoUrl,
    faviconUrl: payload.faviconUrl || FALLBACK_BRANDING.faviconUrl,
    brandingVersion: payload.brandingVersion || FALLBACK_BRANDING.brandingVersion,
  };
}

export function useBrandingAssets() {
  const [branding, setBranding] = useState<BrandingState>(cachedBranding || FALLBACK_BRANDING);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      try {
        const nextBranding = await fetchBrandingAssets();

        if (!nextBranding || cancelled) {
          return;
        }

        cachedBranding = nextBranding;
        setBranding(cachedBranding);
      } catch {
        // Branding should never block page rendering.
      }
    }

    void loadBranding();
    window.addEventListener(BRANDING_UPDATED_EVENT, loadBranding);

    return () => {
      cancelled = true;
      window.removeEventListener(BRANDING_UPDATED_EVENT, loadBranding);
    };
  }, []);

  return branding;
}

export function BrandingFaviconUpdater() {
  const branding = useBrandingAssets();

  useEffect(() => {
    if (!branding.faviconUrl) {
      return;
    }

    const iconSelectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'];

    for (const selector of iconSelectors) {
      const rel = selector.includes("shortcut") ? "shortcut icon" : selector.includes("apple") ? "apple-touch-icon" : "icon";
      let links = Array.from(document.querySelectorAll<HTMLLinkElement>(selector));

      if (!links.length) {
        const link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
        links = [link];
      }

      for (const link of links) {
        link.href = branding.faviconUrl;
        link.removeAttribute("type");
      }
    }
  }, [branding.faviconUrl]);

  return null;
}
