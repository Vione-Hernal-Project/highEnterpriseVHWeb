"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";

import { ProductGrid } from "@/components/storefront/product-grid";
import type { CatalogProduct } from "@/lib/catalog";

type CatalogPageResponse = {
  products?: CatalogProduct[];
  hasMore?: boolean;
  total?: number;
  error?: string;
};

type CatalogFilters = {
  category?: string | null;
  department?: string | null;
  newArrivals?: boolean;
};

type Props = {
  activeFilterLabel?: string;
  clientProducts?: CatalogProduct[];
  emptyAction?: ReactNode;
  emptyMessage: string;
  filters?: CatalogFilters;
  hero: {
    eyebrow: string;
    title: string;
    copy: string;
  };
  initialHasMore: boolean;
  initialProducts: CatalogProduct[];
  initialTotal: number;
  pageSize?: number;
  shopFilters?: {
    categoryOptions: readonly string[];
    departmentOptions: readonly string[];
  };
  toolbar?: ReactNode;
};

function normalizeCatalogFilters(filters?: CatalogFilters): CatalogFilters {
  return {
    category: filters?.category ?? null,
    department: filters?.department ?? null,
    newArrivals: Boolean(filters?.newArrivals),
  };
}

function getCatalogFilterKey(filters?: CatalogFilters) {
  const normalizedFilters = normalizeCatalogFilters(filters);

  return [normalizedFilters.department || "", normalizedFilters.category || "", normalizedFilters.newArrivals ? "new" : ""].join("|");
}

function getShopFilterSlug(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function buildShopHref(filters: CatalogFilters) {
  const params = new URLSearchParams();

  if (filters.department) {
    params.set("department", getShopFilterSlug(filters.department));
  }

  if (filters.category) {
    params.set("category", getShopFilterSlug(filters.category));
  }

  const query = params.toString();

  return query ? `/shop?${query}` : "/shop";
}

function resolveShopFilterOption(value: string | null, options: readonly string[]) {
  if (!value) {
    return null;
  }

  const slug = getShopFilterSlug(value.replace(/-/g, " "));

  return options.find((option) => getShopFilterSlug(option) === slug) ?? null;
}

function productMatchesFilters(product: CatalogProduct, filters: CatalogFilters) {
  const normalizedFilters = normalizeCatalogFilters(filters);
  const departmentMatches = normalizedFilters.department ? product.department === normalizedFilters.department : true;
  const categoryMatches = normalizedFilters.category ? product.categoryLabel === normalizedFilters.category : true;
  const newArrivalMatches = normalizedFilters.newArrivals ? product.showInNewArrivals : true;

  return departmentMatches && categoryMatches && newArrivalMatches;
}

function shouldHandleFilterClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function isMobileFilterViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
}

function ShopFilterToolbar({
  activeFilters,
  categoryOptions,
  departmentOptions,
  onSelect,
}: {
  activeFilters: CatalogFilters;
  categoryOptions: readonly string[];
  departmentOptions: readonly string[];
  onSelect: (filters: CatalogFilters) => void;
}) {
  const activeCategory = activeFilters.category ?? null;
  const activeDepartment = activeFilters.department ?? null;
  const mobilePointerStartRef = useRef<{ x: number; y: number; filterKey: string } | null>(null);
  const handledMobileFilterKeyRef = useRef<string | null>(null);

  function handleMobileFilterPointerDown(event: PointerEvent<HTMLAnchorElement>, nextFilters: CatalogFilters) {
    if (event.pointerType === "mouse" || !isMobileFilterViewport()) {
      return;
    }

    mobilePointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      filterKey: getCatalogFilterKey(nextFilters),
    };
  }

  function handleMobileFilterPointerUp(event: PointerEvent<HTMLAnchorElement>, nextFilters: CatalogFilters) {
    if (event.pointerType === "mouse" || !isMobileFilterViewport()) {
      return;
    }

    const filterKey = getCatalogFilterKey(nextFilters);
    const pointerStart = mobilePointerStartRef.current;
    mobilePointerStartRef.current = null;

    if (!pointerStart || pointerStart.filterKey !== filterKey) {
      return;
    }

    const movedX = Math.abs(event.clientX - pointerStart.x);
    const movedY = Math.abs(event.clientY - pointerStart.y);

    if (movedX > 10 || movedY > 10) {
      return;
    }

    event.preventDefault();
    handledMobileFilterKeyRef.current = filterKey;
    onSelect(nextFilters);

    window.setTimeout(() => {
      if (handledMobileFilterKeyRef.current === filterKey) {
        handledMobileFilterKeyRef.current = null;
      }
    }, 400);
  }

  function handleFilterClick(event: MouseEvent<HTMLAnchorElement>, nextFilters: CatalogFilters) {
    if (!shouldHandleFilterClick(event)) {
      return;
    }

    event.preventDefault();

    const filterKey = getCatalogFilterKey(nextFilters);

    if (handledMobileFilterKeyRef.current === filterKey) {
      handledMobileFilterKeyRef.current = null;
      return;
    }

    onSelect(nextFilters);
  }

  return (
    <div className="vh-shop-filters">
      <div className="vh-shop-filter-group">
        <span className="vh-shop-filter-label">Department</span>
        <div className="vh-shop-filter-links">
          <a
            className={`vh-shop-filter-chip ${!activeDepartment ? "vh-shop-filter-chip--active" : ""}`}
            href={buildShopHref({ category: activeCategory })}
            onPointerDown={(event) => handleMobileFilterPointerDown(event, { category: activeCategory, department: null })}
            onPointerUp={(event) => handleMobileFilterPointerUp(event, { category: activeCategory, department: null })}
            onClick={(event) => handleFilterClick(event, { category: activeCategory, department: null })}
          >
            All
          </a>
          {departmentOptions.map((department) => (
            <a
              key={department}
              className={`vh-shop-filter-chip ${activeDepartment === department ? "vh-shop-filter-chip--active" : ""}`}
              href={buildShopHref({ department, category: null })}
              onPointerDown={(event) => handleMobileFilterPointerDown(event, { department, category: null })}
              onPointerUp={(event) => handleMobileFilterPointerUp(event, { department, category: null })}
              onClick={(event) => handleFilterClick(event, { department, category: null })}
            >
              {department}
            </a>
          ))}
        </div>
      </div>

      <div className="vh-shop-filter-group">
        <span className="vh-shop-filter-label">Category</span>
        <div className="vh-shop-filter-links">
          <a
            className={`vh-shop-filter-chip ${!activeCategory ? "vh-shop-filter-chip--active" : ""}`}
            href={buildShopHref({ department: activeDepartment })}
            onPointerDown={(event) => handleMobileFilterPointerDown(event, { department: activeDepartment, category: null })}
            onPointerUp={(event) => handleMobileFilterPointerUp(event, { department: activeDepartment, category: null })}
            onClick={(event) => handleFilterClick(event, { department: activeDepartment, category: null })}
          >
            All
          </a>
          {categoryOptions.map((category) => (
            <a
              key={category}
              className={`vh-shop-filter-chip ${activeCategory === category ? "vh-shop-filter-chip--active" : ""}`}
              href={buildShopHref({ department: activeDepartment, category })}
              onPointerDown={(event) => handleMobileFilterPointerDown(event, { department: activeDepartment, category })}
              onPointerUp={(event) => handleMobileFilterPointerUp(event, { department: activeDepartment, category })}
              onClick={(event) => handleFilterClick(event, { department: activeDepartment, category })}
            >
              {category}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  clientProducts,
  emptyAction,
  emptyMessage,
  filters,
  hero,
  initialHasMore,
  initialProducts,
  initialTotal,
  pageSize = 20,
  shopFilters,
  toolbar,
}: Props) {
  const initialFilterKey = getCatalogFilterKey(filters);
  const initialFilters = useMemo(() => normalizeCatalogFilters(filters), [initialFilterKey]);
  const availableClientProducts = clientProducts ?? [];
  const usesClientProducts = Array.isArray(clientProducts);
  const [activeFilters, setActiveFilters] = useState<CatalogFilters>(initialFilters);
  const [products, setProducts] = useState(initialProducts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadedIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  const clientFilteredProducts = useMemo(() => {
    if (!usesClientProducts) {
      return [];
    }

    return availableClientProducts.filter((product) => productMatchesFilters(product, activeFilters));
  }, [activeFilters, availableClientProducts, usesClientProducts]);
  const displayedProducts = usesClientProducts ? clientFilteredProducts.slice(0, visibleCount) : products;
  const displayedTotal = usesClientProducts ? clientFilteredProducts.length : total;
  const displayedHasMore = usesClientProducts ? visibleCount < clientFilteredProducts.length : hasMore;
  const displayedActiveFilterLabel = shopFilters ? [activeFilters.department, activeFilters.category].filter(Boolean).join(" / ") : activeFilterLabel;
  const displayedAvailabilityLabel = `${displayedTotal} item${displayedTotal === 1 ? "" : "s"} available${
    displayedActiveFilterLabel ? ` in ${displayedActiveFilterLabel}` : ""
  }`;
  const displayedEmptyMessage =
    shopFilters && displayedActiveFilterLabel ? `No published products match ${displayedActiveFilterLabel}.` : emptyMessage;
  const renderedToolbar = shopFilters ? (
    <ShopFilterToolbar
      activeFilters={activeFilters}
      categoryOptions={shopFilters.categoryOptions}
      departmentOptions={shopFilters.departmentOptions}
      onSelect={(nextFilters) => {
        const normalizedFilters = normalizeCatalogFilters(nextFilters);

        setActiveFilters(normalizedFilters);
        setVisibleCount(pageSize);
        setError("");
        setLoadingMore(false);
        window.history.pushState({}, "", buildShopHref(normalizedFilters));
      }}
    />
  ) : (
    toolbar
  );

  useEffect(() => {
    setActiveFilters(initialFilters);
    setProducts(initialProducts);
    setHasMore(initialHasMore);
    setTotal(initialTotal);
    setVisibleCount(pageSize);
    setLoadingMore(false);
    setError("");
  }, [initialFilters, initialHasMore, initialProducts, initialTotal, pageSize]);

  useEffect(() => {
    if (!shopFilters) {
      return;
    }

    const activeShopFilters = shopFilters;

    function handlePopState() {
      const params = new URLSearchParams(window.location.search);

      setActiveFilters({
        department: resolveShopFilterOption(params.get("department"), activeShopFilters.departmentOptions),
        category: resolveShopFilterOption(params.get("category"), activeShopFilters.categoryOptions),
        newArrivals: false,
      });
      setVisibleCount(pageSize);
      setLoadingMore(false);
      setError("");
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pageSize, shopFilters]);

  const loadMore = useCallback(async () => {
    if (usesClientProducts) {
      setVisibleCount((currentVisibleCount) => Math.min(currentVisibleCount + pageSize, clientFilteredProducts.length));
      return;
    }

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

      if (activeFilters.department) {
        params.set("department", activeFilters.department);
      }

      if (activeFilters.category) {
        params.set("category", activeFilters.category);
      }

      if (activeFilters.newArrivals) {
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
  }, [
    activeFilters.category,
    activeFilters.department,
    activeFilters.newArrivals,
    clientFilteredProducts.length,
    hasMore,
    loadedIds,
    loadingMore,
    pageSize,
    products.length,
    total,
    usesClientProducts,
  ]);

  if (!displayedProducts.length) {
    return (
      <>
        <div className="storefront-app-hero">
          <p className="u-text--sm u-uppercase u-margin-b--sm">{hero.eyebrow}</p>
          <h1 className="h2 u-margin-b--md">{hero.title}</h1>
          <p className="u-margin-b--none">{shopFilters ? displayedAvailabilityLabel : hero.copy}</p>
        </div>
        {renderedToolbar}
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">{displayedEmptyMessage}</p>
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
        <p className="u-margin-b--none">{displayedAvailabilityLabel}</p>
      </div>

      {renderedToolbar}
      <ProductGrid products={displayedProducts} showCta={false} />
      {loadingMore ? <ProductGridSkeleton count={Math.min(4, pageSize)} /> : null}

      {error ? <p className="vh-load-more-status">{error}</p> : null}

      {displayedHasMore ? (
        <div className="vh-load-more">
          <button type="button" className="vh-button vh-button--ghost" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading" : "Load More"}
          </button>
        </div>
      ) : null}
    </>
  );
}
