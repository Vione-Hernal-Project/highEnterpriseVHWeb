import { AdminCustomerCreateView } from "@/components/admin/admin-customer-create-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewCustomerPage() {
  await requireManagementUser();

  return <AdminCustomerCreateView />;
}
