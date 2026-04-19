import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { loadPublishedCatalogProduct } from "@/lib/products";

type Props = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductPage({ params }: Props) {
  const { productId } = await params;
  const product = await loadPublishedCatalogProduct(productId);

  if (!product) {
    notFound();
  }

  return <ProductDetailView product={product} />;
}
