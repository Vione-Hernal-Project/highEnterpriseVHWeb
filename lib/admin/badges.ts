import "server-only";

import { getCurrentUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminBadgeCounts = {
  ordersActionableCount: number;
};

export async function loadAdminBadgeCounts(): Promise<AdminBadgeCounts> {
  try {
    const { user, canManageOrders } = await getCurrentUserContext();

    if (!user || !canManageOrders) {
      return { ordersActionableCount: 0 };
    }

    const admin = createSupabaseAdminClient();
    const { count, error } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      return { ordersActionableCount: 0 };
    }

    return { ordersActionableCount: count || 0 };
  } catch {
    return { ordersActionableCount: 0 };
  }
}
