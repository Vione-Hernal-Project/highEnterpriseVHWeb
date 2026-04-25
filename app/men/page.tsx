import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/storefront/product-grid";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Men - Luxury Streetwear",
  description: "Explore Vione Hernal luxury streetwear and web3 fashion. Menswear edits will appear as the collection expands.",
  path: "/men",
});

export default async function MenPage() {
  const products = (await loadPublishedCatalogProducts()).filter((product) => product.department === "Mens");

  return (
    <section className="storefront-app-view">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Men", path: "/men" }])} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Men</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">Men</p>
        <h1 className="h2 u-margin-b--md">Men</h1>
        <p className="u-margin-b--none">Luxury streetwear and blockchain fashion edits from Vione Hernal.</p>
      </div>
      {products.length ? (
        <ProductGrid products={products} showCta={false} />
      ) : (
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">Menswear edits are coming soon.</p>
          <Link className="vh-button" href="/shop">
            Browse Shop
          </Link>
        </div>
      )}
    </section>
  );
}
