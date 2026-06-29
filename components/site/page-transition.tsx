"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type Props = {
  children: ReactNode;
};

export function PageTransition({ children }: Props) {
  // Re-key on the pathname so the fade-in animation replays on every navigation.
  const pathname = usePathname();

  return (
    <div key={pathname} className="vh-page-transition">
      {children}
    </div>
  );
}
