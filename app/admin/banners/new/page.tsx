import { AdminBannerCreateView } from "@/components/admin/admin-banner-create-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNewBannerPage() {
  await requireAdminArea("content");

  return <AdminBannerCreateView />;
}
