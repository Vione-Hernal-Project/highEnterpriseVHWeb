"use client";

import { startTransition, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  getAdminAccessAreaForPath,
  getDefaultAdminHref,
  hasAdminAccess,
  normalizeAdminRole,
  type AdminRole,
} from "@/lib/admin/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  initialRole: AdminRole | null;
  userId: string;
};

type ProfilePayload = {
  role?: string | null;
  profile?: {
    role?: string | null;
  } | null;
};

const ROLE_SYNC_INTERVAL_MS = 30000;

export function AdminRoleSync({ initialRole, userId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const roleRef = useRef<AdminRole | null>(normalizeAdminRole(initialRole));
  const pathnameRef = useRef(pathname);
  const inFlightRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refreshForRole = useCallback((nextRole: AdminRole | null) => {
    const currentPathname = pathnameRef.current || "/admin";
    const requiredArea = getAdminAccessAreaForPath(currentPathname);

    startTransition(() => {
      if (!nextRole) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (requiredArea && !hasAdminAccess(nextRole, requiredArea)) {
        router.replace(getDefaultAdminHref(nextRole));
      }

      router.refresh();
    });
  }, [router]);

  const applyRole = useCallback((rawRole: string | null | undefined) => {
    const nextRole = normalizeAdminRole(rawRole);

    if (nextRole === roleRef.current) {
      return;
    }

    roleRef.current = nextRole;
    refreshForRole(nextRole);
  }, [refreshForRole]);

  const checkCurrentRole = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        applyRole(null);
        return;
      }

      if (!response.ok) {
        return;
      }

      const payload = await response.json() as ProfilePayload;
      applyRole(payload.role ?? payload.profile?.role ?? null);
    } catch {
      // Role sync is a guardrail; the server/API guards still enforce access.
    } finally {
      inFlightRef.current = false;
    }
  }, [applyRole]);

  useEffect(() => {
    void checkCurrentRole();

    const interval = window.setInterval(() => {
      void checkCurrentRole();
    }, ROLE_SYNC_INTERVAL_MS);

    const handleFocus = () => {
      void checkCurrentRole();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkCurrentRole();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkCurrentRole]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin-role-sync:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          applyRole((payload.new as { role?: string | null }).role);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyRole, userId]);

  useEffect(() => {
    const requiredArea = getAdminAccessAreaForPath(pathname);
    const currentRole = roleRef.current;

    if (!currentRole) {
      router.replace("/dashboard");
      return;
    }

    if (requiredArea && !hasAdminAccess(currentRole, requiredArea)) {
      router.replace(getDefaultAdminHref(currentRole));
    }
  }, [pathname, router]);

  return null;
}
