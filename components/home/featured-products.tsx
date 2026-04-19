import { ProductGrid } from "@/components/storefront/product-grid";
import type { CatalogProduct } from "@/lib/catalog";

type Props = {
  products: CatalogProduct[];
};

export function FeaturedProducts({ products }: Props) {
  return <ProductGrid products={products} showCta={false} />;
}
