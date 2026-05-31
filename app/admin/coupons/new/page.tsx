import { AdminCouponCreateView } from "@/components/admin/admin-coupon-create-view";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNewCouponPage() {
  await requireAdminArea("coupons");

  return <AdminCouponCreateView />;
}
