import { AdminCustomerCreateView } from "@/components/admin/admin-customer-create-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNewCustomerPage() {
  await requireAdminArea("customers");

  return <AdminCustomerCreateView />;
}
