"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { SiteBanners } from "@/components/site/site-banners";
import { PageTransition } from "@/components/site/page-transition";
import { StoreMaintenanceView } from "@/components/site/store-maintenance-view";
import { StorefrontSettingsProvider, type StorefrontPublicSettings } from "@/components/site/storefront-settings-context";
import { fetchLiveStorefrontSettings, subscribeToStorefrontSettings } from "@/lib/storefront/settings-live-sync";

type Props = {
  children: ReactNode;
  storefrontSettings: StorefrontPublicSettings;
};

function canAccessWhenStoreIsPaused(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/")
  );
}

export function SiteFrame({ children, storefrontSettings }: Props) {
  const pathname = usePathname();
  const [currentStorefrontSettings, setCurrentStorefrontSettings] = useState(storefrontSettings);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const storeIsPaused = !currentStorefrontSettings.enableStore && !canAccessWhenStoreIsPaused(pathname);

  useEffect(() => {
    setCurrentStorefrontSettings(storefrontSettings);
  }, [storefrontSettings]);

  useEffect(() => {
    if (isAdminRoute) {
      return undefined;
    }

    let cancelled = false;
    const refreshStorefrontSettings = async () => {
      const latestSettings = await fetchLiveStorefrontSettings();

      if (!cancelled && latestSettings) {
        setCurrentStorefrontSettings(latestSettings);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshStorefrontSettings();
      }
    };
    const unsubscribe = subscribeToStorefrontSettings((settings) => {
      setCurrentStorefrontSettings(settings);
    });

    void refreshStorefrontSettings();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAdminRoute]);

  if (isAdminRoute) {
    return (
      <div className="vh-admin-root-frame">
        <PageTransition>{children}</PageTransition>
      </div>
    );
  }

  if (storeIsPaused) {
    return (
      <StorefrontSettingsProvider settings={currentStorefrontSettings}>
        <StoreMaintenanceView settings={currentStorefrontSettings} />
      </StorefrontSettingsProvider>
    );
  }

  return (
    <StorefrontSettingsProvider settings={currentStorefrontSettings}>
      <div className="vh-app-shell">
        <SiteHeader />
        <SiteBanners />
        <main id="page-content" className="vh-main">
          <div className="container">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        <SiteFooter signedIn={false} />
      </div>
    </StorefrontSettingsProvider>
  );
}
