import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const { adminRole } = await requireAdminArea("settings");
  return <AdminSettingsView section="general" adminRole={adminRole} />;
}
