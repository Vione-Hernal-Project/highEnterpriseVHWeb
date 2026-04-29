import type { Metadata } from "next";
import Link from "next/link";

import { PaginatedProductCatalog } from "@/components/storefront/paginated-product-catalog";
import { loadPublishedCatalogProductsPage } from "@/lib/products";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "New Arrivals - Minimal Luxury Fashion",
  description: "New arrivals from Vione Hernal: minimal luxury fashion, refined designer streetwear, and blockchain fashion pieces.",
  path: "/new",
});

export default async function NewArrivalsPage() {
  const initialPage = await loadPublishedCatalogProductsPage({
    offset: 0,
    limit: 20,
    newArrivalsOnly: true,
  });

  return (
    <section className="storefront-app-view vh-new-arrivals-page">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>New Arrivals</span>
      </nav>

      <PaginatedProductCatalog
        emptyAction={
          <Link className="vh-button" href="/shop">
            Browse Shop
          </Link>
        }
        emptyMessage="No products are marked for New Arrivals yet."
        filters={{ newArrivals: true }}
        hero={{
          eyebrow: "Newest Published Pieces",
          title: "New Arrivals",
          copy: "Sorted by newest published items first.",
        }}
        initialHasMore={initialPage.hasMore}
        initialProducts={initialPage.products}
        initialTotal={initialPage.total}
      />
    </section>
  );
}
