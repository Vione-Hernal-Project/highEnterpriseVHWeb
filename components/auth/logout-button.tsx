"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
  children?: ReactNode;
  redirectTo?: string;
  variant?: "button" | "link";
};

export function LogoutButton({ className, children, redirectTo = "/sign-in", variant = "button" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className={cn(variant === "link" ? "vh-auth-link vh-auth-link--button" : "vh-button vh-button--ghost", className)}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {loading ? "Logging Out..." : (children ?? "Log Out")}
    </button>
  );
}
