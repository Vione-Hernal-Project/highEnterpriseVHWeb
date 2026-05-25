import { AdminCampaignCreateView } from "@/components/admin/admin-campaign-create-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewCampaignPage() {
  await requireManagementUser();

  return <AdminCampaignCreateView />;
}
