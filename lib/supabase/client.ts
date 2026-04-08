"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { assertPublicSupabaseEnv, logPublicSupabaseEnvStatus, publicEnv } from "@/lib/env/public";

let singleton: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  logPublicSupabaseEnvStatus("browser-client");
  assertPublicSupabaseEnv();

  if (!singleton) {
    singleton = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }

  return singleton;
}
