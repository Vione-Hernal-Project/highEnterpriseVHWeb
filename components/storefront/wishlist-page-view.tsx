"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductGrid } from "@/components/storefront/product-grid";
import { featuredProducts } from "@/lib/catalog";
import { readWishlistProductIds, subscribeToStorefrontState } from "@/lib/storefront/storage";

export function WishlistPageView() {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    function syncWishlist() {
      setWishlistIds(readWishlistProductIds());
    }

    syncWishlist();

    return subscribeToStorefrontState(syncWishlist);
  }, []);

  const products = featuredProducts.filter((product) => wishlistIds.includes(product.id));

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Wish List</span>
      </nav>

      {products.length ? (
        <>
          <div className="storefront-app-hero">
            <p className="u-text--sm u-uppercase u-margin-b--sm">Saved Items</p>
            <h1 className="h2 u-margin-b--md">Wish List</h1>
            <p className="u-margin-b--none">{products.length} item{products.length === 1 ? "" : "s"} saved</p>
          </div>
          <ProductGrid products={products} />
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
