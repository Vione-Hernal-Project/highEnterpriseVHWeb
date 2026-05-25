import "server-only";

import type { Json } from "@/lib/database.types";
import { isMissingAdminSettingsTableError } from "@/lib/admin/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const NOTIFICATION_READS_KEY_PREFIX = "admin_notification_reads";
const MAX_STORED_READ_IDS = 300;

function getNotificationReadsKey(userId: string) {
  return `${NOTIFICATION_READS_KEY_PREFIX}:${userId}`;
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && !Array.isArray(value) && typeof value === "object");
}

function readIdsFromValue(value: Json | null | undefined) {
  if (!isRecord(value) || !Array.isArray(value.readIds)) {
    return [];
  }

  return value.readIds.filter((id): id is string => typeof id === "string");
}

export async function loadAdminNotificationReadIds(userId: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", getNotificationReadsKey(userId))
      .maybeSingle();

    if (error) {
      if (isMissingAdminSettingsTableError(error)) {
        return [];
      }

      throw new Error(error.message);
    }

    return readIdsFromValue(data?.value);
  } catch {
    return [];
  }
}

export async function saveAdminNotificationReadIds(userId: string, notificationIds: string[]) {
  const currentReadIds = await loadAdminNotificationReadIds(userId);
  const readIds = [...new Set([...currentReadIds, ...notificationIds])].slice(-MAX_STORED_READ_IDS);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_settings").upsert(
    {
      key: getNotificationReadsKey(userId),
      value: { readIds },
      updated_by: userId,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return readIds;
}
