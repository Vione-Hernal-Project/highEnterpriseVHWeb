import { AdminReviewFormView } from "@/components/admin/admin-review-form-view";
import { loadAdminReviewFormOptions } from "@/lib/admin/review-form-options";
import { requireManagementUser } from "@/lib/auth";

export default async function AdminNewReviewPage() {
  await requireManagementUser();
  const options = await loadAdminReviewFormOptions();

  return (
    <>
      {options.loadError ? <div className="vh-admin-alert"><p>{options.loadError}</p></div> : null}
      <AdminReviewFormView products={options.products} customers={options.customers} orders={options.orders} />
    </>
  );
}
