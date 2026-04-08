function readEnvValue(keys) {
  const runtimeSources = [
    globalThis.__SUPABASE_ENV__,
    globalThis.__ENV__,
    typeof globalThis.process !== "undefined" ? globalThis.process.env : undefined,
    typeof import.meta !== "undefined" ? import.meta.env : undefined,
  ];

  for (const source of runtimeSources) {
    if (!source) {
      continue;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

const defaultSupabaseUrl = "https://uibyqlonafqhaxeuslpj.supabase.co";
const defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpYnlxbG9uYWZxaGF4ZXVzbHBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODAyOTgsImV4cCI6MjA5MDk1NjI5OH0.f8l-UTIRB-lX-pEgITpejFa6Gyv3Y6XfcinACk9qTcg";
const defaultPublicSiteUrl = "";

export const supabaseConfig = {
  url: readEnvValue(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) || defaultSupabaseUrl,
  anonKey:
    readEnvValue(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) ||
    defaultSupabaseAnonKey,
};

export const storefrontConfig = {
  brandName: "Vione Hernal",
  brandSupportEmail: "service@vionehernal.com",
  currency: "PHP",
  currencyLocale: "en-PH",
  emailOtpLength: 8,
  authRequiredForCheckout: true,
  shippingFlatRate: 0,
  allowDomCatalogFallback: true,
  publicSiteUrl:
    readEnvValue(["PUBLIC_SITE_URL", "SITE_URL", "VITE_PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL"]) || defaultPublicSiteUrl,
  authCallbackPath: "/auth/callback",
  passwordResetPath: "/auth/reset-password",
};
