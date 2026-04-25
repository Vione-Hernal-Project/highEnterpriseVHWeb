import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/storefront/product-grid";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Bags - Designer Streetwear Philippines",
  description: "Shop Vione Hernal bags, top-handle silhouettes, and designer streetwear accessories from the Philippines.",
  path: "/bags",
});

export default async function BagsPage() {
  const products = (await loadPublishedCatalogProducts()).filter((product) => product.categoryLabel === "Bags");

  return (
    <section className="storefront-app-view">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Bags", path: "/bags" }])} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Bags</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">Bags</p>
        <h1 className="h2 u-margin-b--md">Bags</h1>
        <p className="u-margin-b--none">Top-handle bags and accessories shaped by minimal luxury fashion.</p>
      </div>
      <ProductGrid products={products} showCta={false} />
    </section>
  );
}
