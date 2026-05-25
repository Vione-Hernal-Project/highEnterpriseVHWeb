import { AdminCollectionCreateView } from "@/components/admin/admin-collection-create-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewCollectionPage() {
  await requireManagementUser();

  return <AdminCollectionCreateView />;
}
