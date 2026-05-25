import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { loadAdminBadgeCounts } from "@/lib/admin/badges";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const badges = await loadAdminBadgeCounts();

  return <AdminShell ordersActionableCount={badges.ordersActionableCount}>{children}</AdminShell>;
}
