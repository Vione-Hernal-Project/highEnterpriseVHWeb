import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { requireManagementUser } from "@/lib/auth";

type Props = {
  params: Promise<{
    section: string;
  }>;
};

export default async function AdminSettingsSectionPage({ params }: Props) {
  await requireManagementUser();
  const { section } = await params;
  return <AdminSettingsView section={section} />;
}
