import type { Metadata } from "next";
import Link from "next/link";

import { CatalogRefreshListener } from "@/components/storefront/catalog-refresh-listener";
import { ProductGrid } from "@/components/storefront/product-grid";
import { catalogProductMatchesDepartment } from "@/lib/catalog";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Women - Minimal Luxury Fashion",
  description: "Shop Vione Hernal womenswear, bags, shoes, and refined designer streetwear with a minimal luxury point of view.",
  path: "/women",
});

export const dynamic = "force-dynamic";

export default async function WomenPage() {
  const products = (await loadPublishedCatalogProducts()).filter((product) => catalogProductMatchesDepartment(product.department, "Womens"));

  return (
    <section className="storefront-app-view">
      <CatalogRefreshListener />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Women", path: "/women" }])} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Women</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">Women</p>
        <h1 className="h2 u-margin-b--md">Women</h1>
        <p className="u-margin-b--none">Minimal luxury fashion and designer streetwear by Vione Hernal.</p>
      </div>
      <ProductGrid products={products} showCta={false} />
    </section>
  );
}
