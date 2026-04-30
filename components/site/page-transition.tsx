"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function PageTransition({ children }: Props) {
  return <div className="vh-page-transition">{children}</div>;
}
