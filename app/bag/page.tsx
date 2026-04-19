import { BagPageView } from "@/components/storefront/bag-page-view";
import { loadPublishedCatalogProducts } from "@/lib/products";

export default async function BagPage() {
  const products = await loadPublishedCatalogProducts();

  return <BagPageView products={products} />;
}
