"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";
import {
  getCatalogPriceLabel,
  getCatalogProductPageHref,
  getCatalogSubtotalPhpCents,
  type CatalogProduct,
} from "@/lib/catalog";
import { readBagItems, removeBagItem, subscribeToStorefrontState, updateBagItemQuantity, type StorefrontBagItem } from "@/lib/storefront/storage";

type BagLineItem = StorefrontBagItem & {
  brand: string;
  image: string;
  name: string;
  pricePhpCents: number;
  productHref: string;
};

type Props = {
  products: CatalogProduct[];
};

export function BagPageView({ products }: Props) {
  const [bagItems, setBagItems] = useState<StorefrontBagItem[]>([]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    function syncBag() {
      setBagItems(readBagItems());
    }

    syncBag();

    return subscribeToStorefrontState(syncBag);
  }, []);

  const items = useMemo(
    () =>
      bagItems
        .map((item) => {
          const product = productMap.get(item.productId);

          if (!product) {
            return null;
          }

          return {
            ...item,
            brand: product.brand,
            image: product.image,
            name: product.name,
            pricePhpCents: product.pricePhpCents,
            productHref: getCatalogProductPageHref(product.id),
          } satisfies BagLineItem;
        })
        .filter((item): item is BagLineItem => Boolean(item)),
    [bagItems, productMap],
  );

  const subtotalPhpCents = items.reduce(
    (total, item) => total + getCatalogSubtotalPhpCents(item.pricePhpCents, item.quantity),
    0,
  );
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalLabel = formatPhpCurrencyFromCents(subtotalPhpCents);

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>My Bag</span>
      </nav>

      <h1 className="h2 u-margin-b--xl">My Bag</h1>

      {items.length ? (
        <div className="storefront-app-grid">
          <div className="storefront-app-list">
            {items.map((item) => {
              return (
                <article key={item.itemKey} className="storefront-app-card storefront-app-cart-item">
                  <Link href={item.productHref}>
                    <Image src={item.image} alt={item.name} width={180} height={240} sizes="(max-width: 767px) 38vw, 180px" />
                  </Link>
                  <div>
                    <div className="storefront-app-inline">
                      <div>
                        <p className="u-text--sm u-uppercase u-margin-b--sm">{item.brand}</p>
                        <h2 className="h4 u-margin-b--sm">
                          <Link href={item.productHref}>{item.name}</Link>
                        </h2>
                        <p className="u-margin-b--sm">Size {item.size}</p>
                        <p className="u-margin-b--none">
                          <strong>{getCatalogPriceLabel(item.pricePhpCents)}</strong>
                        </p>
                      </div>
                      <button type="button" className="link" onClick={() => removeBagItem(item.itemKey)}>
                        Remove
                      </button>
                    </div>

                    <div className="storefront-app-inline u-margin-t--lg">
                      <div className="storefront-app-qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateBagItemQuantity(item.itemKey, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateBagItemQuantity(item.itemKey, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <strong>{formatPhpCurrencyFromCents(getCatalogSubtotalPhpCents(item.pricePhpCents, item.quantity))}</strong>
                    </div>

                  </div>
                </article>
              );
            })}
          </div>

          <aside className="storefront-app-card">
            <h2 className="h4 u-margin-b--lg">Order Summary</h2>
            <div className="storefront-app-summary">
              <div className="storefront-app-summary-row">
                <span>Total Items</span>
                <strong>{totalQuantity}</strong>
              </div>
              <div className="storefront-app-summary-row">
                <span>Subtotal</span>
                <strong>{totalLabel}</strong>
              </div>
              <div className="storefront-app-summary-row">
                <span>Shipping</span>
                <strong>{formatPhpCurrencyFromCents(0)}</strong>
              </div>
              <div className="storefront-app-summary-row">
                <span>Total</span>
                <strong>{totalLabel}</strong>
              </div>
            </div>
            <div className="vh-actions">
              <Link className="vh-button" href="/checkout">
                Proceed To Checkout
              </Link>
            </div>
            <p className="vh-payment-note" style={{ marginTop: "1rem" }}>
              Checkout now carries your full bag into one order summary, one address form, and one payment.
            </p>
          </aside>
        </div>
      ) : (
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">Your bag is empty.</p>
          <Link className="vh-button" href="/">
            Continue Shopping
          </Link>
        </div>
      )}
    </section>
  );
}
