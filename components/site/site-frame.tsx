"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { PageTransition } from "@/components/site/page-transition";

type Props = {
  children: ReactNode;
};

export function SiteFrame({ children }: Props) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return <div className="vh-admin-root-frame">{children}</div>;
  }

  return (
    <div className="vh-app-shell">
      <SiteHeader />
      <main id="page-content" className="vh-main">
        <div className="container">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <SiteFooter signedIn={false} />
    </div>
  );
}
