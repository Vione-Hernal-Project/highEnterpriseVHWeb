import { AdminCampaignCreateView } from "@/components/admin/admin-campaign-create-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNewCampaignPage() {
  await requireAdminArea("marketing");

  return <AdminCampaignCreateView />;
}
