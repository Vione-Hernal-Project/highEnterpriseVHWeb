import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminSettingsPage() {
  await requireManagementUser();
  return <AdminSettingsView section="general" />;
}
