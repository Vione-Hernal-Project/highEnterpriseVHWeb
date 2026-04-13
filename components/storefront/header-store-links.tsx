"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBagCount, getWishlistCount, subscribeToStorefrontState } from "@/lib/storefront/storage";

export function HeaderStoreLinks() {
  const [wishlistCount, setWishlistCount] = useState(0);
  const [bagCount, setBagCount] = useState(0);

  useEffect(() => {
    function syncCounts() {
      setWishlistCount(getWishlistCount());
      setBagCount(getBagCount());
    }

    syncCounts();

    return subscribeToStorefrontState(syncCounts);
  }, []);

  return (
    <>
      <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
        <Link href="/wishlist">Wish List ({wishlistCount})</Link>
      </li>
      <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
        <Link href="/bag">My Bag ({bagCount})</Link>
      </li>
    </>
  );
}
