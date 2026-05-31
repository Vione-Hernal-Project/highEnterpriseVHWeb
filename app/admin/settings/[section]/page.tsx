import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { requireAdminArea } from "@/lib/auth";

function getSettingsAccessArea(section: string) {
  if (section === "admin") {
    return "admin-settings" as const;
  }

  if (section === "payment-methods") {
    return "wallet-settings" as const;
  }

  return "settings" as const;
}

type Props = {
  params: Promise<{
    section: string;
  }>;
};

export default async function AdminSettingsSectionPage({ params }: Props) {
  const { section } = await params;
  const { adminRole } = await requireAdminArea(getSettingsAccessArea(section));

  return <AdminSettingsView section={section} adminRole={adminRole} />;
}
