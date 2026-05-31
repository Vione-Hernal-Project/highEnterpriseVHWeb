import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminRoleSync } from "@/components/admin/admin-role-sync";
import { requireAnyAdminUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { adminRole, user } = await requireAnyAdminUser();

  return (
    <AdminShell adminRole={adminRole} userEmail={user.email || "admin@vionehernal.com"}>
      <AdminRoleSync initialRole={adminRole} userId={user.id} />
      {children}
    </AdminShell>
  );
}
