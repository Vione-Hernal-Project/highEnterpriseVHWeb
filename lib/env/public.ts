export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
};

const loggedContexts = new Set<string>();

export function getPublicSupabaseEnvStatus() {
  return {
    hasUrl: Boolean(publicEnv.supabaseUrl),
    hasAnonKey: Boolean(publicEnv.supabaseAnonKey),
  };
}

export function logPublicSupabaseEnvStatus(context: string) {
  if (process.env.NODE_ENV !== "development" || loggedContexts.has(context)) {
    return;
  }

  loggedContexts.add(context);

  console.info(`[supabase-env:${context}]`, getPublicSupabaseEnvStatus());
}

export function hasPublicSupabaseEnv() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function getPublicSupabaseEnvError() {
  const missingValues = [
    !publicEnv.supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !publicEnv.supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
  ].filter(Boolean);

  if (!missingValues.length) {
    return null;
  }

  return `Supabase is not configured. Add ${missingValues.join(" and ")} to .env.local and restart the Next.js dev server.`;
}

export function assertPublicSupabaseEnv() {
  const error = getPublicSupabaseEnvError();

  if (error) {
    throw new Error(error);
  }
}
