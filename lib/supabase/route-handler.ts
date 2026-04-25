import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { Database } from "@/lib/database.types";
import { assertServerEnv, serverEnv } from "@/lib/env/server";

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function createSupabaseRouteHandlerClient() {
  assertServerEnv(
    [serverEnv.supabaseUrl, serverEnv.supabaseAnonKey],
    "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the Next.js dev server.",
  );

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({
            name,
            value,
            options: options ? ({ ...options } as Record<string, unknown>) : undefined,
          });

          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route handlers can always write to the outgoing response, so this
            // local cookie store update is just a best-effort sync for the request scope.
          }
        });
      },
    },
  });

  function applyPendingCookies<T extends NextResponse>(response: T) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({
        name,
        value,
        ...(options ?? {}),
      } as never);
    });

    return response;
  }

  return {
    supabase,
    applyPendingCookies,
  };
}
