import { notFound } from "next/navigation";

import { AdminReviewFormView } from "@/components/admin/admin-review-form-view";
import { loadAdminReviewFormOptions } from "@/lib/admin/review-form-options";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminProductReview } from "@/lib/reviews";

type Props = {
  params: Promise<{
    reviewId: string;
  }>;
};

export default async function AdminEditReviewPage({ params }: Props) {
  await requireAdminArea("reviews");
  const { reviewId } = await params;
  const [review, options] = await Promise.all([
    loadAdminProductReview(reviewId),
    loadAdminReviewFormOptions(),
  ]);

  if (!review) {
    notFound();
  }

  const products = options.products.some((product) => product.id === review.productId)
    ? options.products
    : [{ id: review.productId, name: review.productId }, ...options.products];
  const customers = options.customers.some((customer) => customer.key === review.customerKey)
    ? options.customers
    : [{ key: review.customerKey, name: review.customerName, email: review.customerEmail }, ...options.customers];

  return (
    <>
      {options.loadError ? <div className="vh-admin-alert"><p>{options.loadError}</p></div> : null}
      <AdminReviewFormView products={products} customers={customers} orders={options.orders} initialReview={review} />
    </>
  );
}
