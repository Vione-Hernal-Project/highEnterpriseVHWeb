import { redirect } from "next/navigation";

import { requireAdminArea } from "@/lib/auth";

export default async function AdminLedgerPage() {
  await requireAdminArea("ledger");
  redirect("/admin/ledger/transactions");
}
