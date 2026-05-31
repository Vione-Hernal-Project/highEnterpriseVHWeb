import "server-only";

import { redirect } from "next/navigation";

import {
  getDefaultAdminHref,
  hasAdminAccess,
  normalizeAdminRole,
  type AdminAccessArea,
  type AdminRole,
  type StoreRole,
} from "@/lib/admin/access";
import type { Database } from "@/lib/database.types";
import { hasPublicSupabaseEnv } from "@/lib/env/public";
import { getConfiguredOwnerEmails, hasSupabaseAdminEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function resolveRole(profileRole: string | null | undefined, email: string | null | undefined): StoreRole {
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail && getConfiguredOwnerEmails().includes(normalizedEmail)) {
    return "super_admin";
  }

  return normalizeAdminRole(profileRole) ?? "user";
}

async function syncOwnerRole(profile: ProfileRow | null, email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (
    !normalizedEmail ||
    !getConfiguredOwnerEmails().includes(normalizedEmail) ||
    !profile ||
    profile.role === "super_admin" ||
    !hasSupabaseAdminEnv()
  ) {
    return profile;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").update({ role: "super_admin" }).eq("id", profile.id).select("*").maybeSingle();

  return data ?? { ...profile, role: "super_admin" };
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
      adminRole: null as AdminRole | null,
      isStaffUser: false,
      canManageOrders: false,
      isManagementUser: false,
      isOwner: false,
      isSuperAdmin: false,
    };
  }

  const { data: rawProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const ensuredProfile = rawProfile ?? (await ensureProfileRow(user));
  const profile = await syncOwnerRole(ensuredProfile ?? null, user.email);
  const role = resolveRole(profile?.role, user.email);
  const adminRole = normalizeAdminRole(role);

  return {
    supabase,
    user,
    profile,
    role,
    adminRole,
    isStaffUser: adminRole === "orders_manager",
    canManageOrders: hasAdminAccess(adminRole, "orders"),
    isManagementUser: adminRole === "full_admin" || adminRole === "super_admin",
    isOwner: adminRole === "super_admin",
    isSuperAdmin: adminRole === "super_admin",
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
    redirect(getDefaultAdminHref(context.role));
  }

  return context;
}

export async function requireOrderOperationsUser() {
  return requireAdminArea("orders");
}

export async function requireAnyAdminUser() {
  const context = await requireUser();

  if (!context.adminRole) {
    redirect("/dashboard");
  }

  return context;
}

export async function requireAdminArea(area: AdminAccessArea) {
  const context = await requireAnyAdminUser();

  if (!hasAdminAccess(context.role, area)) {
    redirect(getDefaultAdminHref(context.role));
  }

  return context;
}

export async function requireOwner() {
  return requireAdminArea("admin-settings");
}

export async function getAdminApiAccess(area: AdminAccessArea) {
  const context = await getCurrentUserContext();

  if (!context.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Authentication required.",
      context,
    };
  }

  if (!context.adminRole || !hasAdminAccess(context.role, area)) {
    return {
      ok: false as const,
      status: 403,
      error: "Admin access required.",
      context,
    };
  }

  return {
    ok: true as const,
    context,
  };
}
