import { NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE_VALUES, type AdminRole } from "@/lib/admin/access";
import { getAdminApiAccess } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { absoluteUrl } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ADMIN_INVITE_WINDOW_MS = 10 * 60_000;
const ADMIN_INVITE_LIMIT = 20;
const ADMIN_INVITE_BODY_LIMIT_BYTES = 8 * 1024;

const adminInviteSchema = z.object({
  email: z.string().trim().email("Enter a valid admin email address.").max(180, "Admin email is too long."),
  role: z.enum(ADMIN_ROLE_VALUES, {
    errorMap: () => ({ message: "Select a valid admin role." }),
  }),
});

async function findAuthUserIdByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.users.find((user) => user.email?.toLowerCase() === email)?.id || "";
}

export async function POST(request: Request) {
  try {
    const access = await getAdminApiAccess("admin-settings");

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_INVITE_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:profiles:invite:user:${access.context.user.id}`,
      limit: ADMIN_INVITE_LIMIT,
      windowMs: ADMIN_INVITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many admin invitations were sent from this account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid admin invitation request." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const role = parsed.data.role as AdminRole;
    const admin = createSupabaseAdminClient();
    const existingProfile = await admin.from("profiles").select("*").eq("email", email).maybeSingle();

    if (existingProfile.error) {
      return NextResponse.json({ error: existingProfile.error.message }, { status: 500 });
    }

    if (existingProfile.data) {
      const { data, error } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", existingProfile.data.id)
        .select("*")
        .single();

      if (error || !data) {
        return NextResponse.json({ error: error?.message || "Unable to update this admin profile." }, { status: 500 });
      }

      return NextResponse.json({ profile: data, invited: false });
    }

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: absoluteUrl("/auth/callback?next=/admin"),
    });
    let invitedUserId = inviteData.user?.id || "";

    if (inviteError) {
      const existingUserId = inviteError.message.toLowerCase().includes("already")
        ? await findAuthUserIdByEmail(admin, email)
        : "";

      if (!existingUserId) {
        return NextResponse.json({ error: inviteError.message }, { status: 500 });
      }

      invitedUserId = existingUserId;
    }

    if (!invitedUserId) {
      return NextResponse.json({ error: "Unable to create the invited admin user." }, { status: 500 });
    }

    const { data, error } = await admin
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          email,
          role,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to save this admin profile." }, { status: 500 });
    }

    return NextResponse.json({ profile: data, invited: !inviteError });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to invite this admin right now.") }, { status: 500 });
  }
}
