import { AdminCollectionCreateView } from "@/components/admin/admin-collection-create-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNewCollectionPage() {
  await requireAdminArea("collections");

  return <AdminCollectionCreateView />;
}
