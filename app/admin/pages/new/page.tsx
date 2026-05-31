import { AdminPageCreateView } from "@/components/admin/admin-page-create-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminSitePageOptions } from "@/lib/site-pages";

export default async function AdminNewPageRoute() {
  await requireAdminArea("content");
  const parentOptions = await loadAdminSitePageOptions();

  return <AdminPageCreateView parentOptions={parentOptions} />;
}
