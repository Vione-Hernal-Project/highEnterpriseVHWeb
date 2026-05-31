import type { Metadata } from "next";
import Link from "next/link";

import { FeaturedProducts } from "@/components/home/featured-products";
import { MenEditorialOverlayMotion } from "@/components/site/men-editorial-overlay-motion";
import { CatalogRefreshListener } from "@/components/storefront/catalog-refresh-listener";
import { ProductGrid } from "@/components/storefront/product-grid";
import { catalogProductMatchesDepartment, type CatalogProduct } from "@/lib/catalog";
import { loadFeaturedCatalogProducts, loadPublishedCatalogProducts } from "@/lib/products";
import { absoluteUrl, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Men - Luxury Streetwear",
  description: "Explore Vione Hernal luxury streetwear and web3 fashion. Menswear edits will appear as the collection expands.",
  path: "/men",
});

export const dynamic = "force-dynamic";

const menBreadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Men",
      item: absoluteUrl("/men"),
    },
  ],
};

function getProductDedupeKey(product: CatalogProduct) {
  const name = String(product.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const image = String(product.image ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const price = String(product.pricePhpCents ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  return `${name}|${image}|${price}`;
}

export default async function MenPage() {
  const allProducts = await loadPublishedCatalogProducts();
  const products: CatalogProduct[] = [];

  for (const product of allProducts) {
    if (catalogProductMatchesDepartment(product.department, "Mens")) {
      products.push(product);
    }
  }

  const featuredProducts = await loadFeaturedCatalogProducts(24, "Mens");
  const featuredProductIds = new Set<string>();
  const featuredProductKeys = new Set<string>();
  const listedProducts: CatalogProduct[] = [];

  for (const product of featuredProducts) {
    featuredProductIds.add(product.id);
    featuredProductKeys.add(getProductDedupeKey(product));
  }

  for (const product of products) {
    if (!featuredProductIds.has(product.id) && !featuredProductKeys.has(getProductDedupeKey(product))) {
      listedProducts.push(product);
    }
  }

  return (
    <section className="storefront-app-view vh-men-page">
      <CatalogRefreshListener />
      <JsonLd data={menBreadcrumbJsonLd} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Men</span>
      </nav>

      <div className="vh-men-editorial" aria-label="Vione Hernal menswear editorial preview">
        <MenEditorialOverlayMotion />
        <figure className="vh-men-editorial__panel vh-men-editorial__panel--brand">
          <img src="/assets/images/men/vione-hernal-liquid-graphic-clean.png" alt="" width="1085" height="1449" />
          <figcaption className="vh-men-editorial__brand-overlay" aria-hidden="true">
            <span>Vione Hernal</span>
            <strong>#VioneHernal</strong>
          </figcaption>
        </figure>

        <div className="vh-men-editorial__grid">
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--city">
            <img src="/assets/images/men/men-city-noir-look.jpg" alt="" width="485" height="621" />
            <figcaption className="vh-men-editorial__overlay">
              <span>City Form</span>
              <strong>Refined Utility</strong>
            </figcaption>
          </figure>
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--portrait">
            <img src="/assets/images/men/men-golf-resort-look.jpg" alt="" width="611" height="960" />
            <figcaption className="vh-men-editorial__overlay vh-men-editorial__overlay--center">
              <span>Off Duty</span>
              <strong>Elevated Ease</strong>
            </figcaption>
          </figure>
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--wide">
            <img src="/assets/images/men/men-studio-cap-editorial.png" alt="" width="1537" height="1023" />
            <figcaption className="vh-men-editorial__overlay vh-men-editorial__overlay--cap">
              <span>Everyday Luxury</span>
              <strong>Understated by Design</strong>
            </figcaption>
          </figure>
        </div>

        <section className="vh-men-featured" aria-label="Featured menswear">
          {featuredProducts.length ? (
            <div className="vh-home-page__featured-shell">
              <div className="vh-home-page__featured-header">
                <h3 className="vh-home-page__featured-title u-margin-tb--none">Featured Items</h3>
              </div>
              <FeaturedProducts products={featuredProducts} />
            </div>
          ) : null}
        </section>
      </div>

      {listedProducts.length ? <ProductGrid products={listedProducts} showCta={false} /> : null}
    </section>
  );
}
