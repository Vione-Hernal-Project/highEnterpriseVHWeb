import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getConfiguredOwnerEmails } from "@/lib/env/server";
import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { profileRoleSchema } from "@/lib/validations/order";

export async function PATCH(request: Request) {
  try {
    const { user, isOwner } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isOwner) {
      return NextResponse.json({ error: "Owner access required." }, { status: 403 });
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
