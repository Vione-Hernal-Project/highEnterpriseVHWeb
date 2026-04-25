import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getConfiguredOwnerEmails } from "@/lib/env/server";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { profileRoleSchema } from "@/lib/validations/order";

const ADMIN_ROLE_UPDATE_WINDOW_MS = 10 * 60_000;
const ADMIN_ROLE_UPDATE_LIMIT = 30;
const ADMIN_ROLE_UPDATE_BODY_LIMIT_BYTES = 8 * 1024;

export async function PATCH(request: Request) {
  try {
    const { user, isOwner } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isOwner) {
      return NextResponse.json({ error: "Owner access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_ROLE_UPDATE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:profiles:role:user:${user.id}`,
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

    if (profile.email && getConfiguredOwnerEmails().includes(profile.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Owner access is controlled by STORE_OWNER_EMAILS and cannot be changed here." },
        { status: 400 },
      );
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

    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the profile role right now.") }, { status: 500 });
  }
}
