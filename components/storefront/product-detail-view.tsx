"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { WishlistToggleButton } from "@/components/storefront/wishlist-toggle-button";
import { addBagItem } from "@/lib/storefront/storage";
import { getCatalogPriceLabel, getCatalogProductUiMeta, type CatalogProduct } from "@/lib/catalog";

type ProductReview = {
  id: string;
  customerName: string;
  title: string;
  content: string;
  rating: number;
  isFeatured: boolean;
  isVerifiedPurchase: boolean;
  nameDisplay: "first_name" | "full_name" | "anonymous" | string;
  submittedAt: string;
};

type Props = {
  product: CatalogProduct;
  reviews?: ProductReview[];
};

function getReviewCustomerName(review: ProductReview) {
  if (review.nameDisplay === "anonymous") {
    return "Verified customer";
  }

  if (review.nameDisplay === "first_name") {
    return review.customerName.trim().split(/\s+/)[0] || "Verified customer";
  }

  return review.customerName || "Verified customer";
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProductDetailView({ product, reviews = [] }: Props) {
  const productUiMeta = getCatalogProductUiMeta(product);
  const [selectedSize, setSelectedSize] = useState(productUiMeta.sizes[0] ?? "One Size");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0;

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">{productUiMeta.categoryLabel}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="storefront-app-grid">
        <div className="storefront-app-media vh-product-detail-media">
          <WishlistToggleButton productId={product.id} productName={product.name} />
          <Image src={product.image} alt={product.name} width={720} height={960} sizes="(max-width: 1024px) 100vw, 50vw" priority />
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
                className={`action-button action-button--black action-button--lg ${justAdded ? "is-confirmed" : ""}`}
                onClick={() => {
                  setJustAdded(true);
                  addBagItem({
                    productId: product.id,
                    quantity: Number(quantity || "1"),
                    size: selectedSize,
                  });
                  setMessage(`${product.name} added to your bag.`);
                  window.setTimeout(() => setJustAdded(false), 650);
                }}
              >
                {justAdded ? "Added" : "Add To Bag"}
              </button>
              <Link className="vh-button vh-button--ghost" href="/bag">
                View My Bag
              </Link>
            </div>
          </div>

          {message ? <div className="vh-status vh-product-detail-note">{message}</div> : null}
        </div>
      </div>

      {reviews.length ? (
        <section className="vh-product-reviews" aria-label={`${product.name} customer reviews`}>
          <div className="vh-product-reviews__header">
            <div>
              <p className="u-text--sm u-uppercase">Customer Reviews</p>
              <h2>{averageRating.toFixed(1)} / 5</h2>
            </div>
            <span>{reviews.length} approved review{reviews.length === 1 ? "" : "s"}</span>
          </div>
          <div className="vh-product-reviews__list">
            {reviews.map((review) => (
              <article key={review.id} className="vh-product-review-card">
                <div className="vh-product-review-card__topline">
                  <span aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}
                  </span>
                  <time dateTime={review.submittedAt}>{formatReviewDate(review.submittedAt)}</time>
                </div>
                {review.title ? <h3>{review.title}</h3> : null}
                <p>{review.content}</p>
                <footer>
                  <strong>{getReviewCustomerName(review)}</strong>
                  {review.isVerifiedPurchase ? <em>Verified purchase</em> : null}
                  {review.isFeatured ? <em>Featured</em> : null}
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
