import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  ADMIN_SETTINGS_CACHE_TAG,
  GENERAL_SETTINGS_KEY,
  isMissingAdminSettingsTableError,
  loadAdminGeneralSettings,
} from "@/lib/admin/settings";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminGeneralSettingsSchema } from "@/lib/validations/admin-settings";

const ADMIN_SETTINGS_BODY_LIMIT_BYTES = 64 * 1024;
const ADMIN_SETTINGS_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_SETTINGS_WRITE_LIMIT = 30;

function getSettingsStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Settings storage is not installed yet. Apply the updated Supabase schema so settings can be saved.",
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

    const settings = await loadAdminGeneralSettings();

    return NextResponse.json({ settings });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to load settings right now.") }, { status: 500 });
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

    const bodySizeError = getJsonBodySizeError(request, ADMIN_SETTINGS_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:settings:general:write:user:${user.id}`,
      limit: ADMIN_SETTINGS_WRITE_LIMIT,
      windowMs: ADMIN_SETTINGS_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many settings update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminGeneralSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_settings")
      .upsert(
        {
          key: GENERAL_SETTINGS_KEY,
          value: parsed.data,
          updated_by: user.id,
        },
        { onConflict: "key" },
      )
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingAdminSettingsTableError(error)) {
        return getSettingsStorageErrorResponse();
      }

      return NextResponse.json({ error: error?.message || "Unable to save settings right now." }, { status: 500 });
    }

    revalidateTag(ADMIN_SETTINGS_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
    revalidatePath("/checkout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/settings");

    return NextResponse.json({ settings: parsed.data });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save settings right now.") }, { status: 500 });
  }
}
