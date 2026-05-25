"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureMarketingAttribution } from "@/lib/marketing/attribution";

export function MarketingAttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureMarketingAttribution();
  }, [pathname, searchParams]);

  return null;
}
