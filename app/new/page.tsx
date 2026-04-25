import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/storefront/product-grid";
import { loadNewArrivalCatalogProducts } from "@/lib/products";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "New Arrivals - Minimal Luxury Fashion",
  description: "New arrivals from Vione Hernal: minimal luxury fashion, refined designer streetwear, and blockchain fashion pieces.",
  path: "/new",
});

export default async function NewArrivalsPage() {
  const products = await loadNewArrivalCatalogProducts();

  return (
    <section className="storefront-app-view vh-new-arrivals-page">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>New Arrivals</span>
      </nav>

      {products.length ? (
        <>
          <div className="storefront-app-hero">
            <p className="u-text--sm u-uppercase u-margin-b--sm">Newest Published Pieces</p>
            <h1 className="h2 u-margin-b--md">New Arrivals</h1>
            <p className="u-margin-b--none">Sorted by newest published items first.</p>
          </div>
          <ProductGrid products={products} showCta={false} />
        </>
      ) : (
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">No products are marked for New Arrivals yet.</p>
          <Link className="vh-button" href="/shop">
            Browse Shop
          </Link>
        </div>
      )}
    </section>
  );
}
