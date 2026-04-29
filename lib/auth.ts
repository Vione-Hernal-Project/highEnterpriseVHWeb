import "server-only";

import { redirect } from "next/navigation";

import type { Database } from "@/lib/database.types";
import { hasPublicSupabaseEnv } from "@/lib/env/public";
import { getConfiguredOwnerEmails, hasSupabaseAdminEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StoreRole = "user" | "staff" | "admin" | "owner";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function resolveRole(profileRole: string | null | undefined, email: string | null | undefined): StoreRole {
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail && getConfiguredOwnerEmails().includes(normalizedEmail)) {
    return "owner";
  }

  if (profileRole === "owner" || profileRole === "admin" || profileRole === "staff") {
    return profileRole;
  }

  return "user";
}

async function syncOwnerRole(profile: ProfileRow | null, email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (
    !normalizedEmail ||
    !getConfiguredOwnerEmails().includes(normalizedEmail) ||
    !profile ||
    profile.role === "owner" ||
    !hasSupabaseAdminEnv()
  ) {
    return profile;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").update({ role: "owner" }).eq("id", profile.id).select("*").maybeSingle();

  return data ?? { ...profile, role: "owner" };
}

async function ensureProfileRow(user: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>["user"]>) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
      },
      {
        onConflict: "id",
      },
    )
    .select("*")
    .maybeSingle();

  return data ?? null;
}

export async function getCurrentSession() {
  if (!hasPublicSupabaseEnv()) {
    return {
      supabase: null as SupabaseServerClient | null,
      user: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser().catch(() => ({
    data: { user: null },
    error: new Error("Unable to read Supabase session."),
  }));

  return { supabase, user: error ? null : data.user };
}

export async function getCurrentUserContext() {
  const { supabase, user } = await getCurrentSession();

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      role: "user" as StoreRole,
      isStaffUser: false,
      canManageOrders: false,
      isManagementUser: false,
      isOwner: false,
    };
  }

  const { data: rawProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const ensuredProfile = rawProfile ?? (await ensureProfileRow(user));
  const profile = await syncOwnerRole(ensuredProfile ?? null, user.email);
  const role = resolveRole(profile?.role, user.email);

  return {
    supabase,
    user,
    profile,
    role,
    isStaffUser: role === "staff",
    canManageOrders: role === "staff" || role === "admin" || role === "owner",
    isManagementUser: role === "admin" || role === "owner",
    isOwner: role === "owner",
  };
}

export async function requireUser() {
  const context = await getCurrentUserContext();

  if (!context.user || !context.supabase) {
    redirect(hasPublicSupabaseEnv() ? "/sign-in" : "/sign-in?devError=supabase_config_missing");
  }

  return context as typeof context & {
    supabase: SupabaseServerClient;
    user: NonNullable<typeof context.user>;
  };
}

export async function requireManagementUser() {
  const context = await requireUser();

  if (!context.isManagementUser) {
    redirect("/dashboard");
  }

  return context;
}

export async function requireOrderOperationsUser() {
  const context = await requireUser();

  if (!context.canManageOrders) {
    redirect("/dashboard");
  }

  return context;
}

export async function requireOwner() {
  const context = await requireUser();

  if (!context.isOwner) {
    redirect("/admin");
  }

  return context;
}
