"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { CATALOG_REFRESH_STORAGE_KEY } from "@/lib/storefront/catalog-refresh";

export function CatalogRefreshListener() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimeout: number | null = null;
    let channel: BroadcastChannel | null = null;

    function refreshCatalog() {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        router.refresh();
      }, 50);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === CATALOG_REFRESH_STORAGE_KEY) {
        refreshCatalog();
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CATALOG_REFRESH_STORAGE_KEY, refreshCatalog);

    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CATALOG_REFRESH_STORAGE_KEY);
      channel.addEventListener("message", refreshCatalog);
    }

    return () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CATALOG_REFRESH_STORAGE_KEY, refreshCatalog);
      channel?.removeEventListener("message", refreshCatalog);
      channel?.close();
    };
  }, [router]);

  return null;
}
