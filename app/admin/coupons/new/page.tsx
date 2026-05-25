import { AdminCouponCreateView } from "@/components/admin/admin-coupon-create-view";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewCouponPage() {
  await requireManagementUser();

  return <AdminCouponCreateView />;
}
