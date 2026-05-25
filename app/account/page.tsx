import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  await requireUser();

  redirect("/dashboard");
}
