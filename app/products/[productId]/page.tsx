import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { getCatalogProduct } from "@/lib/catalog";

type Props = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductPage({ params }: Props) {
  const { productId } = await params;
  const product = getCatalogProduct(productId);

  if (!product || product.id !== productId) {
    notFound();
  }

  return <ProductDetailView productId={product.id} />;
}
