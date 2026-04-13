"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { WishlistToggleButton } from "@/components/storefront/wishlist-toggle-button";
import { addBagItem } from "@/lib/storefront/storage";
import { getCatalogPriceLabel, getCatalogProduct, getCatalogProductUiMeta } from "@/lib/catalog";

type Props = {
  productId: string;
};

export function ProductDetailView({ productId }: Props) {
  const product = useMemo(() => getCatalogProduct(productId), [productId]);
  const productUiMeta = useMemo(() => getCatalogProductUiMeta(product?.id), [product?.id]);
  const [selectedSize, setSelectedSize] = useState(productUiMeta.sizes[0] ?? "One Size");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");

  if (!product) {
    return null;
  }

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/">{productUiMeta.categoryLabel}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="storefront-app-grid">
        <div className="storefront-app-media vh-product-detail-media">
          <WishlistToggleButton productId={product.id} productName={product.name} />
          <img src={product.image} alt={product.name} width="720" height="960" />
        </div>

        <div className="storefront-app-card">
          <p className="u-text--sm u-uppercase u-margin-b--sm">{product.brand}</p>
          <h1 className="h2 u-margin-b--sm">{product.name}</h1>
          <div className="storefront-app-price">{getCatalogPriceLabel(product.pricePhpCents)}</div>
          <p className="u-margin-b--xl">{product.description}</p>

          <dl className="storefront-app-meta">
            <div>
              <dt>Department</dt>
              <dd>{productUiMeta.department}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{productUiMeta.categoryLabel}</dd>
            </div>
            <div>
              <dt>Product Code</dt>
              <dd>{product.id}</dd>
            </div>
          </dl>

          <div className="storefront-app-actions">
            <div className="vh-product-action-grid">
              <div className="vh-field u-margin-b--none">
                <label htmlFor="product-detail-size">Size</label>
                <select
                  id="product-detail-size"
                  className="vh-input"
                  value={selectedSize}
                  onChange={(event) => setSelectedSize(event.target.value)}
                >
                  {productUiMeta.sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vh-field u-margin-b--none">
                <label htmlFor="product-detail-quantity">Quantity</label>
                <input
                  id="product-detail-quantity"
                  className="vh-input"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            </div>

            <div className="vh-actions">
              <button
                type="button"
                className="action-button action-button--black action-button--lg"
                onClick={() => {
                  addBagItem({
                    productId: product.id,
                    quantity: Number(quantity || "1"),
                    size: selectedSize,
                  });
                  setMessage(`${product.name} added to your bag.`);
                }}
              >
                Add To Bag
              </button>
              <Link className="vh-button vh-button--ghost" href="/bag">
                View My Bag
              </Link>
            </div>
          </div>

          {message ? <div className="vh-status vh-product-detail-note">{message}</div> : null}
        </div>
      </div>
    </section>
  );
}
