import { redirect } from "next/navigation";

import { requireAdminArea } from "@/lib/auth";

export default async function AdminRevenuePage() {
  await requireAdminArea("reports");
  redirect("/admin/analytics");
}
