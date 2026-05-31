import Link from "next/link";

import { WishlistPageView } from "@/components/storefront/wishlist-page-view";
import { loadPublicStorefrontSettings } from "@/lib/admin/settings";
import { loadPublishedCatalogProducts } from "@/lib/products";

export default async function WishlistPage() {
  const settings = await loadPublicStorefrontSettings();

  if (!settings.enableWishlist) {
    return (
      <section className="storefront-app-view">
        <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Wish List</span>
        </nav>
        <h1 className="h2 u-margin-b--xl">Wish List</h1>
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">Wish list is currently unavailable.</p>
          <Link className="vh-button" href="/">
            Continue Shopping
          </Link>
        </div>
      </section>
    );
  }

  const products = await loadPublishedCatalogProducts();

  return <WishlistPageView products={products} />;
}
