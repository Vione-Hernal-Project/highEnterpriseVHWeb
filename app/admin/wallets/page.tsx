import { redirect } from "next/navigation";

import { requireAdminArea } from "@/lib/auth";

export default async function AdminWalletsPage() {
  await requireAdminArea("wallet-settings");
  redirect("/admin/settings/payment-methods");
}
