"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductGrid } from "@/components/storefront/product-grid";
import type { CatalogProduct } from "@/lib/catalog";
import { readWishlistProductIds, subscribeToStorefrontState } from "@/lib/storefront/storage";

type Props = {
  products: CatalogProduct[];
};

export function WishlistPageView({ products }: Props) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    function syncWishlist() {
      setWishlistIds(readWishlistProductIds());
    }

    syncWishlist();

    return subscribeToStorefrontState(syncWishlist);
  }, []);

  const savedProducts = products.filter((product) => wishlistIds.includes(product.id));

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Wish List</span>
      </nav>

      {savedProducts.length ? (
        <>
          <div className="storefront-app-hero">
            <p className="u-text--sm u-uppercase u-margin-b--sm">Saved Items</p>
            <h1 className="h2 u-margin-b--md">Wish List</h1>
            <p className="u-margin-b--none">{savedProducts.length} item{savedProducts.length === 1 ? "" : "s"} saved</p>
          </div>
          <ProductGrid products={savedProducts} />
        </>
      ) : (
        <>
          <h1 className="h2 u-margin-b--xl">Wish List</h1>
          <div className="storefront-app-empty">
            <p className="u-margin-b--lg">You have no saved items yet.</p>
            <Link className="vh-button" href="/">
              Continue Shopping
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
