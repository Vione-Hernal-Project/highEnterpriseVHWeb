import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/seo/seo-landing-page";
import { loadFeaturedCatalogProducts } from "@/lib/products";
import { getSeoLandingPage } from "@/lib/seo-pages";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

const page = getSeoLandingPage("/web3-fashion")!;

export const metadata: Metadata = createSeoMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
});

export default async function Web3FashionPage() {
  const products = await loadFeaturedCatalogProducts(4);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: page.title, path: page.path }])} />
      <SeoLandingPage {...page} products={products} />
    </>
  );
}
