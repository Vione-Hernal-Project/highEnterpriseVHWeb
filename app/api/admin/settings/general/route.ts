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
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminGeneralOtherSettingsPatchSchema, adminGeneralSettingsSchema } from "@/lib/validations/admin-settings";

const ADMIN_SETTINGS_BODY_LIMIT_BYTES = 64 * 1024;
const WALLET_PAYMENT_SETTING_KEYS = [
  "evmEthEnabled",
  "evmUsdcEnabled",
  "evmUsdtEnabled",
  "solEnabled",
  "solUsdcEnabled",
  "solUsdtEnabled",
] as const;

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

function changesWalletPaymentSettings(
  currentSettings: Awaited<ReturnType<typeof loadFreshAdminGeneralSettings>>,
  nextSettings: Awaited<ReturnType<typeof loadFreshAdminGeneralSettings>>,
) {
  return WALLET_PAYMENT_SETTING_KEYS.some((key) => currentSettings[key] !== nextSettings[key]);
}

export async function GET() {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "settings")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
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
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "settings")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
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

    const currentSettings = await loadFreshAdminGeneralSettings();

    if (!hasAdminAccess(role, "wallet-settings") && changesWalletPaymentSettings(currentSettings, parsed.data)) {
      return NextResponse.json({ error: "Super Admin access is required to change wallet/payment settings." }, { status: 403 });
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
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "settings")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
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
