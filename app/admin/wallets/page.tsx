import { redirect } from "next/navigation";

export default function AdminWalletsPage() {
  redirect("/admin/settings/payment-methods");
}
