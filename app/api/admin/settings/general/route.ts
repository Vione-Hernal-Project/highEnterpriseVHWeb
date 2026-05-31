import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  ADMIN_SETTINGS_CACHE_TAG,
  GENERAL_SETTINGS_KEY,
  isMissingAdminSettingsTableError,
  loadAdminGeneralSettings,
  loadFreshAdminGeneralSettings,
} from "@/lib/admin/settings";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminGeneralOtherSettingsPatchSchema, adminGeneralSettingsSchema } from "@/lib/validations/admin-settings";

const ADMIN_SETTINGS_BODY_LIMIT_BYTES = 64 * 1024;

function getSettingsStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Settings storage is not installed yet. Apply the updated Supabase schema so settings can be saved.",
    },
    { status: 501 },
  );
}

function revalidateGeneralSettingsViews() {
  revalidateTag(ADMIN_SETTINGS_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/checkout");
  revalidatePath("/sign-up");
  revalidatePath("/wishlist");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
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

    revalidateGeneralSettingsViews();

    return NextResponse.json({ settings: parsed.data });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save settings right now.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json().catch(() => null);
    const parsed = adminGeneralOtherSettingsPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings payload." }, { status: 400 });
    }

    const currentSettings = await loadFreshAdminGeneralSettings();
    const nextSettings = adminGeneralSettingsSchema.parse({
      ...currentSettings,
      ...parsed.data,
    });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_settings")
      .upsert(
        {
          key: GENERAL_SETTINGS_KEY,
          value: nextSettings,
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

    revalidateGeneralSettingsViews();

    return NextResponse.json({ settings: nextSettings });
  } catch (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return getSettingsStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save settings right now.") }, { status: 500 });
  }
}
