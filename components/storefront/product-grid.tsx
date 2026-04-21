"use client";

import Link from "next/link";

import { WishlistToggleButton } from "@/components/storefront/wishlist-toggle-button";
import { featuredProducts, getCatalogPriceLabel, getCatalogProductPageHref, type CatalogProduct } from "@/lib/catalog";

type Props = {
  ctaLabel?: string;
  products?: CatalogProduct[];
  showCta?: boolean;
};

export function ProductGrid({ ctaLabel = "View This Piece", products = featuredProducts, showCta = true }: Props) {
  return (
    <div className="g n-block-grid--4 product-grids js-product-opt-view">
      {products.map((product) => {
        const productHref = getCatalogProductPageHref(product.id);

        return (
          <div
            key={product.id}
            className={`gc products-grid__item storefront-app-has-hover-alt ${showCta ? "" : "products-grid__item--no-cta"}`}
          >
            <WishlistToggleButton productId={product.id} productName={product.name} />
            <Link className="product-grids__link product__image-alt-trigger" href={productHref}>
              <div className="product-grids__image product__image-container storefront-app-hover-ready">
                <img className="product__image-main-view" src={product.image} alt={product.name} width="385" height="580" />
                <img className="product__image-alt-view" src={product.hoverImage} alt="" width="385" height="580" />
              </div>
              <div className={`product-grids__copy ${showCta ? "" : "product-grids__copy--no-cta"}`}>
                <div className="product-grids__copy-item product-grids__copy-item--bold">{product.brand}</div>
                <div className="product-grids__copy-item">{product.name}</div>
                <div className="product-grids__copy-item prices">{getCatalogPriceLabel(product.pricePhpCents)}</div>
              </div>
            </Link>
            {showCta ? (
              <Link className="vh-card-link" href={productHref}>
                <span className="vh-button">{ctaLabel}</span>
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
