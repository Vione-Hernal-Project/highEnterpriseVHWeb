"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 15000;

export function AdminLiveRefresh() {
  const router = useRouter();
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    router.refresh();
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="vh-admin-live-refresh">
      <span>Live refresh · {lastUpdatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
      <button type="button" className="vh-button vh-button--ghost" onClick={() => void refresh()} disabled={refreshing}>
        <RefreshCw size={16} aria-hidden="true" />
        {refreshing ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}

