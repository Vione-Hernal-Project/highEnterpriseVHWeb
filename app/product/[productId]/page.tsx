import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { getCatalogProductPageHref } from "@/lib/catalog";
import { loadPublishedCatalogProduct, loadPublishedCatalogProducts } from "@/lib/products";
import { breadcrumbJsonLd, createSeoMetadata, getProductSeoDescription, JsonLd, productJsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{
    productId: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId } = await params;
  const product = await loadPublishedCatalogProduct(productId);

  if (!product) {
    return createSeoMetadata({
      title: "Product Not Found",
      path: `/product/${productId}`,
      noIndex: true,
    });
  }

  return createSeoMetadata({
    title: `${product.name} - ${product.categoryLabel}`,
    description: getProductSeoDescription(product),
    path: getCatalogProductPageHref(product.id),
    image: product.image,
  });
}

export default async function ProductPage({ params }: Props) {
  const { productId } = await params;
  const product = await loadPublishedCatalogProduct(productId);

  if (!product) {
    notFound();
  }

  const relatedProducts = (await loadPublishedCatalogProducts())
    .filter((candidate) => candidate.id !== product.id && candidate.categoryLabel === product.categoryLabel)
    .slice(0, 3);

  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: product.name, path: getCatalogProductPageHref(product.id) },
        ])}
      />
      <ProductDetailView product={product} />
      <section className="u-screen-reader" aria-label={`${product.name} styling and product details`}>
        <h2>{product.name} Materials, Fit, And Styling</h2>
        <p>
          {product.name} is presented as {product.categoryLabel.toLowerCase()} within the Vione Hernal minimal luxury fashion language.
          Materials are selected for a refined hand feel, a clean profile, and long-term wardrobe presence.
        </p>
        <p>
          The fit is designed to support modern designer streetwear styling: precise, composed, and easy to pair with elevated essentials.
        </p>
        <p>
          Style it with other Vione Hernal pieces for a quiet luxury wardrobe grounded in blockchain fashion and verified ownership.
        </p>
        <h2>Related Products</h2>
        <ul>
          {relatedProducts.map((relatedProduct) => (
            <li key={relatedProduct.id}>
              <Link href={getCatalogProductPageHref(relatedProduct.id)}>{relatedProduct.name}</Link>
            </li>
          ))}
          <li>
            <Link href="/blockchain-fashion">Explore blockchain fashion</Link>
          </li>
          <li>
            <Link href="/minimal-luxury-fashion">Explore minimal luxury fashion</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
