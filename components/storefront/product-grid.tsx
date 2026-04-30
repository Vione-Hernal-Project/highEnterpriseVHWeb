"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo } from "react";

import { WishlistToggleButton } from "@/components/storefront/wishlist-toggle-button";
import { featuredProducts, getCatalogPriceLabel, getCatalogProductPageHref, type CatalogProduct } from "@/lib/catalog";

type Props = {
  ctaLabel?: string;
  products?: CatalogProduct[];
  showCta?: boolean;
};

function ProductGridComponent({ ctaLabel = "View This Piece", products = featuredProducts, showCta = true }: Props) {
  const router = useRouter();
  const productHrefs = useMemo(() => products.map((product) => getCatalogProductPageHref(product.id)), [products]);

  useEffect(() => {
    const prefetchVisibleProducts = () => {
      productHrefs.slice(0, 24).forEach((productHref) => {
        router.prefetch(productHref);
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchVisibleProducts, { timeout: 1600 });

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(prefetchVisibleProducts, 250);

    return () => clearTimeout(timeoutId);
  }, [productHrefs, router]);

  return (
    <div className="g n-block-grid--4 product-grids js-product-opt-view">
      {products.map((product, index) => {
        const productHref = productHrefs[index];

        function prefetchProduct() {
          router.prefetch(productHref);
        }

        return (
          <div
            key={product.id}
            className={`gc products-grid__item storefront-app-has-hover-alt ${showCta ? "" : "products-grid__item--no-cta"}`}
          >
            <WishlistToggleButton productId={product.id} productName={product.name} />
            <Link
              className="product-grids__link product__image-alt-trigger"
              href={productHref}
              onFocus={prefetchProduct}
              onMouseEnter={prefetchProduct}
              onTouchStart={prefetchProduct}
            >
              <div className="product-grids__image product__image-container storefront-app-hover-ready">
                <Image
                  className="product__image-main-view"
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 321px"
                  priority={index < 2}
                />
                <Image
                  className="product__image-alt-view"
                  src={product.hoverImage}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 321px"
                />
              </div>
              <div className={`product-grids__copy ${showCta ? "" : "product-grids__copy--no-cta"}`}>
                <div className="product-grids__copy-item product-grids__copy-item--bold">{product.brand}</div>
                <div className="product-grids__copy-item">{product.name}</div>
                <div className="product-grids__copy-item prices">{getCatalogPriceLabel(product.pricePhpCents)}</div>
              </div>
            </Link>
            {showCta ? (
              <Link
                className="vh-card-link"
                href={productHref}
                onFocus={prefetchProduct}
                onMouseEnter={prefetchProduct}
                onTouchStart={prefetchProduct}
              >
                <span className="vh-button">{ctaLabel}</span>
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const ProductGrid = memo(ProductGridComponent);
