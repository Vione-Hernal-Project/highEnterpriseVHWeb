"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ProductGrid } from "@/components/storefront/product-grid";
import type { CatalogProduct } from "@/lib/catalog";

type CatalogPageResponse = {
  products?: CatalogProduct[];
  hasMore?: boolean;
  total?: number;
  error?: string;
};

type Props = {
  activeFilterLabel?: string;
  emptyAction?: ReactNode;
  emptyMessage: string;
  filters?: {
    category?: string | null;
    department?: string | null;
    newArrivals?: boolean;
  };
  hero: {
    eyebrow: string;
    title: string;
    copy: string;
  };
  initialHasMore: boolean;
  initialProducts: CatalogProduct[];
  initialTotal: number;
  pageSize?: number;
  toolbar?: ReactNode;
};

function ProductGridSkeleton({ count }: { count: number }) {
  return (
    <div className="g n-block-grid--4 product-grids js-product-opt-view vh-loading-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="gc products-grid__item products-grid__item--no-cta">
          <div className="product-grids__link">
            <div className="product-grids__image product__image-container storefront-app-hover-ready vh-loading-block" />
            <div className="product-grids__copy product-grids__copy--no-cta">
              <div className="vh-loading-line vh-loading-line--product" />
              <div className="vh-loading-line vh-loading-line--product-name" />
              <div className="vh-loading-line vh-loading-line--price" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaginatedProductCatalog({
  activeFilterLabel,
  emptyAction,
  emptyMessage,
  filters,
  hero,
  initialHasMore,
  initialProducts,
  initialTotal,
  pageSize = 20,
  toolbar,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadedIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    setError("");

    try {
      const params = new URLSearchParams({
        offset: String(products.length),
        limit: String(pageSize),
      });

      if (filters?.department) {
        params.set("department", filters.department);
      }

      if (filters?.category) {
        params.set("category", filters.category);
      }

      if (filters?.newArrivals) {
        params.set("newArrivals", "true");
      }

      const response = await fetch(`/api/catalog/products?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as CatalogPageResponse | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Unable to load more products.");
      }

      const incomingProducts = payload.products || [];
      const nextProducts = incomingProducts.filter((product) => !loadedIds.has(product.id));

      setProducts((currentProducts) => {
        const currentIds = new Set(currentProducts.map((product) => product.id));
        const mergedProducts = incomingProducts.filter((product) => !currentIds.has(product.id));

        return [...currentProducts, ...mergedProducts];
      });
      setHasMore(Boolean(payload.hasMore) && nextProducts.length > 0);
      setTotal(typeof payload.total === "number" ? payload.total : total);
    } catch {
      setError("Unable to load more products right now.");
    } finally {
      setLoadingMore(false);
    }
  }, [filters?.category, filters?.department, filters?.newArrivals, hasMore, loadedIds, loadingMore, pageSize, products.length, total]);

  if (!products.length) {
    return (
      <>
        <div className="storefront-app-hero">
          <p className="u-text--sm u-uppercase u-margin-b--sm">{hero.eyebrow}</p>
          <h1 className="h2 u-margin-b--md">{hero.title}</h1>
          <p className="u-margin-b--none">{hero.copy}</p>
        </div>
        {toolbar}
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">{emptyMessage}</p>
          {emptyAction}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">{hero.eyebrow}</p>
        <h1 className="h2 u-margin-b--md">{hero.title}</h1>
        <p className="u-margin-b--none">
          {total} item{total === 1 ? "" : "s"} available
          {activeFilterLabel ? ` in ${activeFilterLabel}` : ""}
        </p>
      </div>

      {toolbar}
      <ProductGrid products={products} showCta={false} />
      {loadingMore ? <ProductGridSkeleton count={Math.min(4, pageSize)} /> : null}

      {error ? <p className="vh-load-more-status">{error}</p> : null}

      {hasMore ? (
        <div className="vh-load-more">
          <button type="button" className="vh-button vh-button--ghost" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading" : "Load More"}
          </button>
        </div>
      ) : null}
    </>
  );
}
