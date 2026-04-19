import { WishlistPageView } from "@/components/storefront/wishlist-page-view";
import { loadPublishedCatalogProducts } from "@/lib/products";

export default async function WishlistPage() {
  const products = await loadPublishedCatalogProducts();

  return <WishlistPageView products={products} />;
}
