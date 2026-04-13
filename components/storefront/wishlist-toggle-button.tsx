"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { readWishlistProductIds, subscribeToStorefrontState, toggleWishlistProduct } from "@/lib/storefront/storage";

type Props = {
  productId: string;
  productName: string;
};

export function WishlistToggleButton({ productId, productName }: Props) {
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    function syncWishlistedState() {
      setWishlisted(readWishlistProductIds().includes(productId));
    }

    syncWishlistedState();

    return subscribeToStorefrontState(syncWishlistedState);
  }, [productId]);

  return (
    <button
      type="button"
      className={`storefront-app-wishlist-button ${wishlisted ? "is-active" : ""}`}
      aria-pressed={wishlisted ? "true" : "false"}
      aria-label={`${wishlisted ? "Remove from" : "Add to"} wish list: ${productName}`}
      onClick={() => {
        const nextState = toggleWishlistProduct(productId);
        setWishlisted(nextState);
      }}
    >
      <span className="storefront-app-wishlist-button__icon" aria-hidden="true">
        <Heart />
      </span>
    </button>
  );
}
