import Link from "next/link";

import { featuredProducts, getCatalogPriceLabel } from "@/lib/catalog";

export function FeaturedProducts() {
  return (
    <div className="g n-block-grid--4 product-grids js-product-opt-view">
      {featuredProducts.map((product) => (
        <div key={product.id} className="gc products-grid__item storefront-app-has-hover-alt">
          <div className="product-grids__link product__image-alt-trigger">
            <div className="product-grids__image product__image-container storefront-app-hover-ready">
              <img className="product__image-main-view" src={product.image} alt={product.name} width="385" height="580" />
              <img className="product__image-alt-view" src={product.hoverImage} alt="" width="385" height="580" />
            </div>
            <div className="product-grids__copy">
              <div className="product-grids__copy-item product-grids__copy-item--bold">{product.brand}</div>
              <div className="product-grids__copy-item">{product.name}</div>
              <div className="product-grids__copy-item prices">{getCatalogPriceLabel(product.pricePhpCents)}</div>
            </div>
          </div>
          <Link className="vh-card-link" href={`/checkout?product=${encodeURIComponent(product.id)}`}>
            <span className="vh-button">Checkout This Piece</span>
          </Link>
        </div>
      ))}
    </div>
  );
}
