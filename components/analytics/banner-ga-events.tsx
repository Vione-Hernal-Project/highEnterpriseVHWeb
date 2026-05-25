"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function getBannerPayload(element: Element) {
  const htmlElement = element as HTMLElement;

  return {
    banner_id: htmlElement.dataset.vhBannerId || "unknown",
    banner_location: htmlElement.dataset.vhBannerLocation || "unknown",
    banner_title: htmlElement.dataset.vhBannerTitle || htmlElement.getAttribute("aria-label") || "Vione Hernal banner",
  };
}

export function BannerGaEvents() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const trackedImpressions = new WeakSet<Element>();
    const trackImpression = (element: Element) => {
      if (trackedImpressions.has(element)) {
        return;
      }

      trackedImpressions.add(element);
      window.gtag?.("event", "vh_banner_impression", getBannerPayload(element));
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          trackImpression(entry.target);
        }
      });
    }, { threshold: [0.35] });
    const observeBanners = () => {
      document.querySelectorAll("[data-vh-banner-id]").forEach((element) => observer.observe(element));
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const banner = target?.closest("[data-vh-banner-id]");

      if (!banner) {
        return;
      }

      window.gtag?.("event", "vh_banner_click", getBannerPayload(banner));
    };
    const mutationObserver = new MutationObserver(observeBanners);

    observeBanners();
    document.addEventListener("click", handleClick, true);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
