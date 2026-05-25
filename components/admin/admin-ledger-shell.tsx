import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function AdminLedgerShell({ children }: Props) {
  return <>{children}</>;
}
