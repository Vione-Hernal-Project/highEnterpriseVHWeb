import "server-only";

import { revalidateTag, unstable_cache as cache } from "next/cache";

import { ADMIN_SETTINGS_CACHE_TAG, DEFAULT_GENERAL_SETTINGS, isMissingAdminSettingsTableError } from "@/lib/admin/settings";
import type { Database, Json } from "@/lib/database.types";
import { serverEnv } from "@/lib/env/server";
import { sendAdminNotificationEmail } from "@/lib/email";
import {
  buildDefaultNotificationRules,
  NOTIFICATION_EVENT_DEFINITIONS,
  NOTIFICATION_EVENT_KEYS,
  type AdminNotificationSettings,
  type NotificationChannel,
  type NotificationEventKey,
} from "@/lib/notifications/definitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSettingRow = Database["public"]["Tables"]["admin_settings"]["Row"];
type AdminNotificationRow = Database["public"]["Tables"]["admin_notifications"]["Row"];

export const NOTIFICATION_SETTINGS_KEY = "notifications";
export const ADMIN_NOTIFICATIONS_CACHE_TAG = "admin-notifications";

const NOTIFICATION_SETTINGS_CACHE_REVALIDATE_SECONDS = 30;
const DEFAULT_NOTIFICATION_EMAIL = "miguel.oresca09@gmail.com";
const PAYMENT_PENDING_TOO_LONG_MINUTES = 30;

type NotificationPayload = {
  entityId: string;
  title?: string;
  message?: string;
  href?: string;
  customerEmail?: string | null;
  customerName?: string | null;
  amount?: string | number | null;
  status?: string | null;
  metadata?: Record<string, Json | undefined>;
};

export type AdminNotificationHistoryItem = {
  id: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: AdminNotificationRow["status"];
  href?: string;
  readAt: string | null;
  deliveredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export const DEFAULT_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  channels: {
    email: true,
    sms: false,
    push: true,
  },
  preferences: {
    language: "English",
    timezone: "Asia/Manila",
    recipientEmail: serverEnv.storeNotificationEmail || DEFAULT_NOTIFICATION_EMAIL,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
  },
  rules: buildDefaultNotificationRules(),
};

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && !Array.isArray(value) && typeof value === "object");
}

function readBoolean(value: Json | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: Json | undefined, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function mapNotificationSettings(row: AdminSettingRow | null): AdminNotificationSettings {
  const settings = isRecord(row?.value) ? row.value : {};
  const channels = isRecord(settings.channels) ? settings.channels : {};
  const preferences = isRecord(settings.preferences) ? settings.preferences : {};
  const storedRules = isRecord(settings.rules) ? settings.rules : {};
  const defaultRules = buildDefaultNotificationRules();
  const rules = NOTIFICATION_EVENT_KEYS.reduce<AdminNotificationSettings["rules"]>((nextRules, eventKey) => {
    const storedRule = isRecord(storedRules[eventKey]) ? storedRules[eventKey] : {};
    nextRules[eventKey] = {
      email: readBoolean(storedRule.email, defaultRules[eventKey].email),
      sms: readBoolean(storedRule.sms, defaultRules[eventKey].sms),
      push: readBoolean(storedRule.push, defaultRules[eventKey].push),
    };
    return nextRules;
  }, {} as AdminNotificationSettings["rules"]);

  return {
    channels: {
      email: readBoolean(channels.email, DEFAULT_NOTIFICATION_SETTINGS.channels.email),
      sms: readBoolean(channels.sms, DEFAULT_NOTIFICATION_SETTINGS.channels.sms),
      push: readBoolean(channels.push, DEFAULT_NOTIFICATION_SETTINGS.channels.push),
    },
    preferences: {
      language: readString(preferences.language, DEFAULT_NOTIFICATION_SETTINGS.preferences.language),
      timezone: readString(preferences.timezone, DEFAULT_NOTIFICATION_SETTINGS.preferences.timezone),
      recipientEmail: readString(
        preferences.recipientEmail,
        serverEnv.storeNotificationEmail || DEFAULT_NOTIFICATION_EMAIL || DEFAULT_GENERAL_SETTINGS.storeEmail,
      ),
      quietHoursEnabled: readBoolean(preferences.quietHoursEnabled, DEFAULT_NOTIFICATION_SETTINGS.preferences.quietHoursEnabled),
      quietHoursStart: readString(preferences.quietHoursStart, DEFAULT_NOTIFICATION_SETTINGS.preferences.quietHoursStart),
      quietHoursEnd: readString(preferences.quietHoursEnd, DEFAULT_NOTIFICATION_SETTINGS.preferences.quietHoursEnd),
    },
    rules,
  };
}

async function loadNotificationSettingsRow() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_settings")
    .select("*")
    .eq("key", NOTIFICATION_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data as AdminSettingRow | null;
}

const loadCachedNotificationSettingsRow = cache(async () => loadNotificationSettingsRow(), ["admin-notification-settings-row"], {
  revalidate: NOTIFICATION_SETTINGS_CACHE_REVALIDATE_SECONDS,
  tags: [ADMIN_SETTINGS_CACHE_TAG],
});

export async function loadAdminNotificationSettings() {
  const row = await loadCachedNotificationSettingsRow();

  return mapNotificationSettings(row);
}

export async function loadFreshAdminNotificationSettings() {
  const row = await loadNotificationSettingsRow();

  return mapNotificationSettings(row);
}

export async function saveAdminNotificationSettings(settings: AdminNotificationSettings, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_settings")
    .upsert(
      {
        key: NOTIFICATION_SETTINGS_KEY,
        value: settings as unknown as Json,
        updated_by: userId,
      },
      { onConflict: "key" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save notification settings.");
  }

  revalidateTag(ADMIN_SETTINGS_CACHE_TAG, { expire: 0 });

  return mapNotificationSettings(data as AdminSettingRow);
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

function getCurrentMinutesInTimeZone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

    return hour * 60 + minute;
  } catch {
    const date = new Date();

    return date.getHours() * 60 + date.getMinutes();
  }
}

function isQuietHour(settings: AdminNotificationSettings, eventKey: NotificationEventKey) {
  if (!settings.preferences.quietHoursEnabled || NOTIFICATION_EVENT_DEFINITIONS[eventKey].urgent) {
    return false;
  }

  const current = getCurrentMinutesInTimeZone(settings.preferences.timezone);
  const start = minutesFromTime(settings.preferences.quietHoursStart);
  const end = minutesFromTime(settings.preferences.quietHoursEnd);

  if (start === end) {
    return false;
  }

  return start < end ? current >= start && current < end : current >= start || current < end;
}

function getEventCopy(eventKey: NotificationEventKey, payload: NotificationPayload) {
  const definition = NOTIFICATION_EVENT_DEFINITIONS[eventKey];
  const title = payload.title || definition.label;
  const message = payload.message || definition.description;

  return { title, message };
}

function sanitizeMetadata(metadata: Record<string, Json | undefined> | undefined) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

async function writeNotificationRow(params: {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  payload: NotificationPayload;
  status: AdminNotificationRow["status"];
  errorMessage?: string | null;
  deliveredAt?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const copy = getEventCopy(params.eventKey, params.payload);
  const dedupeKey = `${params.eventKey}:${params.payload.entityId}`;
  const { data, error } = await admin
    .from("admin_notifications")
    .upsert(
      {
        type: params.eventKey,
        channel: params.channel,
        title: copy.title,
        message: copy.message,
        status: params.status,
        href: params.payload.href || null,
        dedupe_key: dedupeKey,
        metadata: sanitizeMetadata(params.payload.metadata) as Json,
        delivered_at: params.deliveredAt || null,
        error_message: params.errorMessage || null,
      },
      { onConflict: "dedupe_key,channel" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to write notification.");
  }

  revalidateTag(ADMIN_NOTIFICATIONS_CACHE_TAG, { expire: 0 });

  return data as AdminNotificationRow;
}

async function updateNotificationRowStatus(rowId: string, status: AdminNotificationRow["status"], errorMessage?: string | null) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("admin_notifications")
    .update({
      status,
      delivered_at: status === "sent" ? new Date().toISOString() : null,
      error_message: errorMessage || null,
    })
    .eq("id", rowId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTag(ADMIN_NOTIFICATIONS_CACHE_TAG, { expire: 0 });
}

export async function dispatchAdminNotification(eventKey: NotificationEventKey, payload: NotificationPayload) {
  const settings = await loadFreshAdminNotificationSettings();
  const rule = settings.rules[eventKey];

  if (!rule) {
    return;
  }

  const quietHour = isQuietHour(settings, eventKey);
  const enabledChannels = (["push", "email", "sms"] as NotificationChannel[]).filter(
    (channel) => settings.channels[channel] && rule[channel],
  );

  for (const channel of enabledChannels) {
    if (quietHour) {
      await writeNotificationRow({ eventKey, channel, payload, status: "delayed" });
      continue;
    }

    if (channel === "push") {
      await writeNotificationRow({
        eventKey,
        channel,
        payload,
        status: "sent",
        deliveredAt: new Date().toISOString(),
      });
      continue;
    }

    if (channel === "sms") {
      await writeNotificationRow({
        eventKey,
        channel,
        payload,
        status: "skipped",
        errorMessage: "SMS provider is not configured.",
      });
      continue;
    }

    const row = await writeNotificationRow({ eventKey, channel, payload, status: "queued" });
    const result = await sendAdminNotificationEmail({
      to: settings.preferences.recipientEmail,
      title: row.title,
      message: row.message,
      href: row.href,
      eventType: eventKey,
    });

    if (result.status === "sent") {
      await updateNotificationRowStatus(row.id, "sent");
    } else {
      await updateNotificationRowStatus(
        row.id,
        result.status === "not_configured" ? "skipped" : "failed",
        result.status === "not_configured" ? "Email transport is not configured." : "Email delivery failed.",
      );
    }
  }
}

export async function tryDispatchAdminNotification(eventKey: NotificationEventKey, payload: NotificationPayload) {
  try {
    await dispatchAdminNotification(eventKey, payload);
  } catch (error) {
    console.warn("[admin-notifications]", {
      eventKey,
      entityId: payload.entityId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function loadAdminNotificationCenterRows(limit = 12) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_notifications")
    .select("id,type,title,message,href,status,read_at,created_at")
    .eq("channel", "push")
    .in("status", ["sent", "delayed"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAdminSettingsTableError(error) || error.message.includes("admin_notifications")) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    copy: row.message,
    href: row.href || undefined,
    readAt: row.read_at,
    createdAt: row.created_at,
    status: row.status,
    type: row.type,
  }));
}

export async function loadAdminNotificationHistoryRows(limit = 20): Promise<AdminNotificationHistoryItem[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_notifications")
    .select("id,type,channel,title,message,status,href,read_at,delivered_at,error_message,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAdminSettingsTableError(error) || error.message.includes("admin_notifications")) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    channel: row.channel as NotificationChannel,
    title: row.title,
    message: row.message,
    status: row.status,
    href: row.href || undefined,
    readAt: row.read_at,
    deliveredAt: row.delivered_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export function isPaymentPendingTooLong(createdAt: string | null | undefined) {
  if (!createdAt) {
    return false;
  }

  return Date.now() - Date.parse(createdAt) >= PAYMENT_PENDING_TOO_LONG_MINUTES * 60_000;
}
