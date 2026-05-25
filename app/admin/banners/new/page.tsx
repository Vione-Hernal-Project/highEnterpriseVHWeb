import { AdminBannerCreateView } from "@/components/admin/admin-banner-create-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewBannerPage() {
  await requireManagementUser();

  return <AdminBannerCreateView />;
}
