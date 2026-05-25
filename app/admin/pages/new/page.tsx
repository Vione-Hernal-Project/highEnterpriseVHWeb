import { AdminPageCreateView } from "@/components/admin/admin-page-create-view";
import { requireManagementUser } from "@/lib/auth";
import { loadAdminSitePageOptions } from "@/lib/site-pages";

export default async function AdminNewPageRoute() {
  await requireManagementUser();
  const parentOptions = await loadAdminSitePageOptions();

  return <AdminPageCreateView parentOptions={parentOptions} />;
}
