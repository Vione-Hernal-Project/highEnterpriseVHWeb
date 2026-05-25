import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { requireManagementUser } from "@/lib/auth";
import { loadAdminCatalogProducts } from "@/lib/products";
import { loadAdminProductReviews } from "@/lib/reviews";
import { formatDateTime } from "@/lib/utils";

const REVIEW_TABS = ["All Reviews", "Pending", "Approved", "Rejected"];

export default async function AdminReviewsPage() {
  await requireManagementUser();
  const [reviews, products] = await Promise.all([
    loadAdminProductReviews().catch(() => []),
    loadAdminCatalogProducts().catch(() => []),
  ]);
  const productMap = new Map(products.map((product) => [product.id, product.name]));
  const rows: AdminFilteredRow[] = reviews.map((review) => {
    const productName = productMap.get(review.productId) || review.productId;
    const statusLabel = review.status.charAt(0).toUpperCase() + review.status.slice(1);

    return {
    id: review.id,
    status: review.status,
    tabKeys: [statusLabel],
    date: review.submittedAt,
    href: `/admin/reviews/${review.id}`,
    searchText: [review.title, review.content, review.customerName, productName].filter(Boolean).join(" "),
    sortText: review.title || review.customerName,
    facets: {
      rating: `${review.rating} stars`,
      product: productName,
      status: statusLabel,
    },
    metrics: {
      rating: review.rating,
    },
    cells: [
      { kind: "review", title: review.title || review.content.slice(0, 56) || "Untitled review", subtitle: review.content },
      { kind: "text", text: productName },
      { kind: "text", text: review.customerName },
      { kind: "stars", rating: review.rating },
      { kind: "status", text: statusLabel, tone: review.status === "approved" ? "active" : review.status === "rejected" ? "cancelled" : "pending" },
      { kind: "text", text: formatDateTime(review.submittedAt) },
      { kind: "link", href: `/admin/reviews/${review.id}`, text: "Edit" },
    ],
    };
  });

  return (
    <AdminFilteredModule
      title="Reviews"
      subtitle="Manage and moderate customer reviews for your products."
      addLabel="Add Review"
      addHref="/admin/reviews/new"
      stats={[
        { key: "total", label: "Total Reviews", valueKind: "count", delta: "↑ review records", icon: "star", activeTabs: ["All Reviews"] },
        { key: "approved", label: "Approved", valueKind: "count", statusTabs: ["Approved"], delta: "Visible publicly", tone: "green", icon: "message", activeTabs: ["Approved"] },
        { key: "pending", label: "Pending", valueKind: "count", statusTabs: ["Pending"], delta: "Awaiting moderation", tone: "gold", icon: "clock", activeTabs: ["Pending"] },
        { key: "rejected", label: "Rejected", valueKind: "count", statusTabs: ["Rejected"], delta: "Hidden publicly", tone: "rose", icon: "shield", activeTabs: ["Rejected"] },
        { key: "average", label: "Average Rating", valueKind: "average", metricKey: "rating", format: "rating", delta: reviews.length ? "Across all reviews" : "No ratings yet", tone: "purple", icon: "star" },
      ]}
      tabs={REVIEW_TABS}
      searchPlaceholder="Search reviews..."
      filterConfigs={[
        { key: "rating", label: "Rating", allLabel: "All Ratings" },
        { key: "product", label: "Product", allLabel: "All Products" },
        { key: "status", label: "Status", allLabel: "All Status" },
      ]}
      columns={["Review", "Product", "Customer", "Rating", "Status", "Date", "Actions"]}
      rows={rows}
      emptyTitle="No reviews yet."
      emptyCopy="Use Add Review to create an admin review, or approve customer-submitted reviews after purchase."
    />
  );
}
