import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getSupabaseAdminEnvError, serverEnv } from "@/lib/env/server";

let adminClient: ReturnType<typeof createClient<Database>> | undefined;

export function createSupabaseAdminClient() {
  const envError = getSupabaseAdminEnvError();

  if (envError) {
    throw new Error(envError);
  }

  if (!adminClient) {
    adminClient = createClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
