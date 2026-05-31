import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  loadAdminNotificationSettings,
  saveAdminNotificationSettings,
} from "@/lib/admin/notifications";
import { isMissingAdminSettingsTableError } from "@/lib/admin/settings";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { NOTIFICATION_EVENT_KEYS, type AdminNotificationSettings } from "@/lib/notifications/definitions";
import { adminNotificationSettingsSchema } from "@/lib/validations/admin-notifications";

const ADMIN_NOTIFICATION_SETTINGS_BODY_LIMIT_BYTES = 64 * 1024;

function getSettingsStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Notification settings storage is not installed yet. Apply the updated Supabase schema so settings can be saved.",
    },
    { status: 501 },
  );
}

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    return NextResponse.json({ settings: await loadAdminNotificationSettings() });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to load notification settings right now.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_NOTIFICATION_SETTINGS_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = adminNotificationSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid notification settings payload." }, { status: 400 });
    }

    const nextSettings: AdminNotificationSettings = {
      channels: parsed.data.channels,
      preferences: parsed.data.preferences,
      rules: NOTIFICATION_EVENT_KEYS.reduce<AdminNotificationSettings["rules"]>((rules, key) => {
        rules[key] = parsed.data.rules[key];
        return rules;
      }, {} as AdminNotificationSettings["rules"]),
    };
    const settings = await saveAdminNotificationSettings(nextSettings, user.id);

    revalidatePath("/admin");
    revalidatePath("/admin/settings/notifications");

    return NextResponse.json({ settings });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save notification settings right now.") }, { status: 500 });
  }
}
