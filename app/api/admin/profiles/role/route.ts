import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { normalizeAdminRole } from "@/lib/admin/access";
import { getAdminApiAccess } from "@/lib/auth";
import { getConfiguredOwnerEmails } from "@/lib/env/server";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { profileRoleSchema } from "@/lib/validations/order";

const ADMIN_ROLE_UPDATE_WINDOW_MS = 10 * 60_000;
const ADMIN_ROLE_UPDATE_LIMIT = 30;
const ADMIN_ROLE_UPDATE_BODY_LIMIT_BYTES = 8 * 1024;

function isOwnerProfile(profile: { email?: string | null; role?: string | null }, ownerEmails: string[]) {
  return profile.role === "owner" || Boolean(profile.email && ownerEmails.includes(profile.email.toLowerCase()));
}

export async function PATCH(request: Request) {
  try {
    const access = await getAdminApiAccess("admin-settings");

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_ROLE_UPDATE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:profiles:role:user:${access.context.user.id}`,
      limit: ADMIN_ROLE_UPDATE_LIMIT,
      windowMs: ADMIN_ROLE_UPDATE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many role update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = profileRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid profile role request." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", parsed.data.profileId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const ownerEmails = getConfiguredOwnerEmails();

    if (isOwnerProfile(profile, ownerEmails)) {
      return NextResponse.json(
        { error: "Owner access is protected and cannot be changed here." },
        { status: 400 },
      );
    }

    if (profile.id === access.context.user.id && normalizeAdminRole(profile.role) === "super_admin" && parsed.data.role === "user") {
      return NextResponse.json({ error: "You cannot remove your own Super Admin access." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ role: parsed.data.role })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin", "layout");

    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the profile role right now.") }, { status: 500 });
  }
}
