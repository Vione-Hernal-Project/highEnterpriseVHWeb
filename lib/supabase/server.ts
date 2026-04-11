import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { assertServerEnv, serverEnv } from "@/lib/env/server";

export async function createSupabaseServerClient() {
  assertServerEnv(
    [serverEnv.supabaseUrl, serverEnv.supabaseAnonKey],
    "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the Next.js dev server.",
  );

  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Components can read cookies but cannot always mutate them
            // during render. Middleware already handles the session refresh path,
            // so we safely no-op here outside Route Handlers / Server Actions.
          }
        });
      },
    },
  });
}
