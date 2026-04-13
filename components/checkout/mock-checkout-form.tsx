"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { WishlistToggleButton } from "@/components/storefront/wishlist-toggle-button";
import {
  getStorefrontBagItemKey,
  removeBagItem,
} from "@/lib/storefront/storage";
import { getCatalogPriceLabel, getCatalogProduct, getCatalogProductUiMeta } from "@/lib/catalog";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";
import { getDefaultCheckoutInput, resolveCheckoutInput, type CheckoutAmountMode } from "@/lib/payments/checkout";
import { sendCryptoPayment, validateWalletCanPay } from "@/lib/web3/payments";

type Props = {
  customerEmail: string;
};

type PricingPreview = {
  product: {
    id: string;
    name: string;
    brand: string;
    description: string;
    pricePhpCents: number;
    image: string;
    hoverImage: string;
  };
  quantity: number;
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  phpPerEth: number;
  phpPerEthLabel: string;
  requiredEth: string;
  requiredEthLabel: string;
  quoteSource: string;
  quoteUpdatedAt: string | null;
};

type SubmissionState = {
  orderId: string;
  orderNumber: string | null;
  paymentId: string;
  paymentMethod: string;
  productName: string;
  quantity: number;
  subtotalPhpLabel: string;
  requiredEthLabel: string;
  payableEthLabel: string;
  recipientWalletAddress: string | null;
  confirmationEmailStatus: string;
  verificationStatus: "paid" | "pending";
  message: string;
};

const SHIPPING_FLAT_RATE_PHP_CENTS = 0;

function formatQuoteTime(value: string | null) {
  if (!value) {
    return "Live";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildShippingAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildOrderNotes(selectedSize: string, notes: string) {
  const trimmedNotes = notes.trim();
  const segments = [selectedSize ? `Selected size: ${selectedSize}` : "", trimmedNotes];

  return segments.filter(Boolean).join("\n");
}

function normalizeRequestedQuantity(value: string | null) {
  const parsed = Number(value || "1");

  if (!Number.isFinite(parsed) || parsed < 1) {
    return "1";
  }

  return String(Math.floor(parsed));
}

export function MockCheckoutForm({ customerEmail }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const fromBag = searchParams.get("from") === "bag";
  const requestedProductId = searchParams.get("product");
  const requestedSize = searchParams.get("size");
  const requestedQuantity = normalizeRequestedQuantity(searchParams.get("quantity"));
  const requestedProduct = fromBag ? getCatalogProduct(requestedProductId) : null;
  const initialProduct = requestedProduct?.id === requestedProductId ? requestedProduct : null;
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Philippines");
  const [productId, setProductId] = useState(initialProduct?.id ?? "");
  const [selectedSize, setSelectedSize] = useState(() => {
    const initialMeta = getCatalogProductUiMeta(initialProduct?.id);

    if (requestedSize && initialMeta.sizes.includes(requestedSize)) {
      return requestedSize;
    }

    return initialMeta.sizes[0] ?? "One Size";
  });
  const [quantity, setQuantity] = useState(requestedQuantity);
  const [paymentMethod] = useState<"eth">("eth");
  const [amountMode, setAmountMode] = useState<CheckoutAmountMode>("php");
  const [enteredAmount, setEnteredAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [submission, setSubmission] = useState<SubmissionState | null>(null);

  useEffect(() => {
    const matchedProduct = fromBag ? getCatalogProduct(requestedProductId) : null;
    const searchProduct = matchedProduct?.id === requestedProductId ? matchedProduct : null;
    const nextMeta = getCatalogProductUiMeta(searchProduct?.id);
    const nextSize = requestedSize && nextMeta.sizes.includes(requestedSize) ? requestedSize : nextMeta.sizes[0] ?? "One Size";

    if (searchProduct?.id !== productId) {
      setProductId(searchProduct?.id ?? "");
      setReviewMode(false);
      setSubmission(null);
      setError("");
    }

    setSelectedSize(nextSize);
    setQuantity(requestedQuantity);
  }, [fromBag, productId, requestedProductId, requestedQuantity, requestedSize]);

  const selectedProduct = useMemo(() => (productId ? getCatalogProduct(productId) : null), [productId]);
  const productUiMeta = useMemo(() => getCatalogProductUiMeta(selectedProduct?.id), [selectedProduct?.id]);
  const shippingAddress = useMemo(
    () => buildShippingAddress([address1, city, province, postalCode, country]),
    [address1, city, province, postalCode, country],
  );

  useEffect(() => {
    const firstSize = productUiMeta.sizes[0] ?? "One Size";

    setSelectedSize((current) => (productUiMeta.sizes.includes(current) ? current : firstSize));
  }, [productUiMeta]);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      if (!productId) {
        return;
      }

      setQuoteLoading(true);
      setQuoteError("");

      try {
        const response = await fetch(
          `/api/quotes/eth-php?productId=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity || "1")}`,
          {
            cache: "no-store",
          },
        );
        const payload = await readJsonSafely<{ error?: string; pricing?: PricingPreview }>(response);

        if (!response.ok || !payload?.pricing) {
          throw new Error(getResponseErrorMessage(payload, "Unable to load the current ETH quote."));
        }

        if (cancelled) {
          return;
        }

        setPricing(payload.pricing);
        setEnteredAmount(getDefaultCheckoutInput(amountMode, payload.pricing));
      } catch (quoteLoadError) {
        if (cancelled) {
          return;
        }

        setPricing(null);
        setQuoteError(getErrorMessage(quoteLoadError, "Unable to load the current ETH quote."));
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }

    void loadPricing();

    return () => {
      cancelled = true;
    };
  }, [amountMode, productId, quantity]);

  const resolvedInput = pricing
    ? resolveCheckoutInput({
        amountMode,
        enteredAmount,
        pricing,
      })
    : null;

  const subtotalLabel = pricing?.subtotalPhpLabel || (selectedProduct ? getCatalogPriceLabel(selectedProduct.pricePhpCents) : "--");
  const shippingLabel = formatPhpCurrencyFromCents(SHIPPING_FLAT_RATE_PHP_CENTS);
  const totalLabel = pricing ? formatPhpCurrencyFromCents(pricing.subtotalPhpCents + SHIPPING_FLAT_RATE_PHP_CENTS) : subtotalLabel;

  function resetForm() {
    setCustomerName("");
    setPhone("");
    setAddress1("");
    setCity("");
    setProvince("");
    setPostalCode("");
    setCountry("Philippines");
    setAmountMode("php");
    setEnteredAmount(pricing ? getDefaultCheckoutInput("php", pricing) : "");
    setNotes("");
    setConfirmed(false);
    setReviewMode(false);
  }

  function handleReview() {
    setError("");
    setSubmission(null);

    if (!formRef.current?.reportValidity()) {
      return;
    }

    if (!pricing) {
      setError(quoteError || "The live ETH quote is still loading.");
      return;
    }

    if (!resolvedInput?.ok) {
      setError(resolvedInput?.error || "Unable to validate the checkout amount.");
      return;
    }

    setReviewMode(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reviewMode) {
      handleReview();
      return;
    }

    if (!pricing || !resolvedInput?.ok) {
      setError("Unable to continue because the pricing details are incomplete.");
      return;
    }

    setLoading(true);
    setError("");
    setSubmission(null);

    try {
      const preparedWallet = await validateWalletCanPay({
        amount: resolvedInput.payableEthAmount,
        paymentMethod,
      });

      const createOrderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity,
          customerName,
          phone,
          shippingAddress,
          enteredAmount,
          amountMode,
          paymentMethod,
          notes: buildOrderNotes(selectedSize, notes),
          confirmed,
        }),
      });

      const createOrderPayload = await readJsonSafely<{
        error?: string;
        order: { id: string; order_number: string | null; confirmation_email_status: string };
        payment: { id: string; payment_method: string; recipient_address?: string | null };
        pricing: {
          subtotalPhpLabel: string;
          requiredEthLabel: string;
          payableEthAmount: string;
          payableEthLabel: string;
        };
        recipientWalletAddress?: string | null;
      }>(createOrderResponse);

      if (!createOrderResponse.ok || !createOrderPayload?.order || !createOrderPayload.payment || !createOrderPayload.pricing) {
        setError(getResponseErrorMessage(createOrderPayload, "Unable to create the order."));
        return;
      }

      const orderSnapshot = {
        orderId: createOrderPayload.order.id,
        orderNumber: createOrderPayload.order.order_number,
        paymentId: createOrderPayload.payment.id,
        paymentMethod: createOrderPayload.payment.payment_method,
        productName: pricing.product.name,
        quantity: pricing.quantity,
        subtotalPhpLabel: createOrderPayload.pricing.subtotalPhpLabel,
        requiredEthLabel: createOrderPayload.pricing.requiredEthLabel,
        payableEthLabel: createOrderPayload.pricing.payableEthLabel,
        recipientWalletAddress: createOrderPayload.payment.recipient_address || createOrderPayload.recipientWalletAddress || null,
        confirmationEmailStatus: createOrderPayload.order.confirmation_email_status,
      };
      const selectedBagItemKey = getStorefrontBagItemKey(productId, selectedSize);

      removeBagItem(selectedBagItemKey);

      try {
        const walletPayment = await sendCryptoPayment({
          amount: createOrderPayload.pricing.payableEthAmount,
          paymentMethod,
          preparedWallet,
          recipientAddress: orderSnapshot.recipientWalletAddress,
        });

        const verifyResponse = await fetch("/api/payments/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentId: orderSnapshot.paymentId,
            txHash: walletPayment.txHash,
            walletAddress: walletPayment.walletAddress,
          }),
        });

        const verifyPayload = await readJsonSafely<{
          error?: string;
          message?: string;
          verificationStatus?: "paid" | "pending" | "invalid";
        }>(verifyResponse);

        if (verifyResponse.status === 202) {
          setSubmission({
            ...orderSnapshot,
            verificationStatus: "pending",
            message: verifyPayload?.message || "Transaction submitted. Waiting for Sepolia confirmation.",
          });
          resetForm();
          return;
        }

        if (!verifyResponse.ok) {
          setSubmission({
            ...orderSnapshot,
            verificationStatus: "pending",
            message: "Order created. Payment is still pending and can be rechecked from the dashboard.",
          });
          setError(
            `${getResponseErrorMessage(verifyPayload, "The on-chain payment could not be verified yet.")} The order remains pending.`,
          );
          resetForm();
          return;
        }

        setSubmission({
          ...orderSnapshot,
          verificationStatus: "paid",
          message: verifyPayload?.message || "Sepolia payment confirmed.",
        });
        resetForm();
      } catch (walletError) {
        setSubmission({
          ...orderSnapshot,
          verificationStatus: "pending",
          message: "Order created. Complete the Sepolia payment from your dashboard when you are ready.",
        });
        setError(`${getErrorMessage(walletError, "MetaMask payment was not completed.")} The order is saved as pending.`);
        resetForm();
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create the order."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vh-checkout-shell">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/bag">My Bag</Link>
        <span>/</span>
        <span>{selectedProduct?.name || "Checkout"}</span>
      </nav>

      {!fromBag || !selectedProduct ? (
        <section className="storefront-app-view">
          <div className="storefront-app-empty">
            <p className="u-margin-b--lg">Checkout is available from your bag only.</p>
            <Link className="vh-button" href="/bag">
              Go To My Bag
            </Link>
          </div>
        </section>
      ) : (
        <section className="storefront-app-grid">
          <div className="storefront-app-media vh-product-detail-media">
            <WishlistToggleButton productId={selectedProduct.id} productName={selectedProduct.name} />
            <img src={selectedProduct.image} alt={selectedProduct.name} width="720" height="960" />
          </div>

          <div className="storefront-app-card">
            <p className="u-text--sm u-uppercase u-margin-b--sm">{selectedProduct.brand}</p>
            <h1 className="h2 u-margin-b--sm">{selectedProduct.name}</h1>
            <div className="storefront-app-price">{getCatalogPriceLabel(selectedProduct.pricePhpCents)}</div>
            <p className="u-margin-b--xl">{selectedProduct.description}</p>

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
                <dd>{selectedProduct.id}</dd>
              </div>
            </dl>

            <div className="storefront-app-actions">
              <div className="vh-product-action-grid">
                <div className="vh-field u-margin-b--none">
                  <label htmlFor="checkout-size">Size</label>
                  <input id="checkout-size" className="vh-input" value={selectedSize} readOnly />
                </div>

                <div className="vh-field u-margin-b--none">
                  <label htmlFor="checkout-product-quantity">Quantity</label>
                  <input id="checkout-product-quantity" className="vh-input" value={quantity} readOnly />
                </div>
              </div>

              <div className="vh-actions">
                <Link className="vh-button vh-button--ghost" href="/bag">
                  Edit In My Bag
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {fromBag && selectedProduct ? (
        <section className="storefront-app-grid vh-checkout-storefront-grid">
        <form ref={formRef} className="storefront-app-card" onSubmit={handleSubmit}>
          <h2 className="h2 u-margin-b--lg">Checkout</h2>

          <div className="vh-field">
            <label htmlFor="checkout-customer-name">Full Name</label>
            <input
              id="checkout-customer-name"
              name="customerName"
              type="text"
              className="vh-input"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="vh-field">
            <label htmlFor="checkout-email">Email</label>
            <input id="checkout-email" name="email" type="email" className="vh-input" value={customerEmail} readOnly />
          </div>

          <div className="vh-field">
            <label htmlFor="checkout-phone">Phone</label>
            <input
              id="checkout-phone"
              name="phone"
              type="tel"
              className="vh-input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              required
            />
          </div>

          <div className="vh-field">
            <label htmlFor="checkout-address1">Address</label>
            <input
              id="checkout-address1"
              name="address1"
              type="text"
              className="vh-input"
              value={address1}
              onChange={(event) => setAddress1(event.target.value)}
              autoComplete="street-address"
              required
            />
          </div>

          <div className="vh-checkout-field-grid">
            <div className="vh-field">
              <label htmlFor="checkout-city">City</label>
              <input id="checkout-city" name="city" type="text" className="vh-input" value={city} onChange={(event) => setCity(event.target.value)} required />
            </div>

            <div className="vh-field">
              <label htmlFor="checkout-province">Province / State</label>
              <input
                id="checkout-province"
                name="province"
                type="text"
                className="vh-input"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="vh-checkout-field-grid">
            <div className="vh-field">
              <label htmlFor="checkout-postal-code">Postal Code</label>
              <input
                id="checkout-postal-code"
                name="postalCode"
                type="text"
                className="vh-input"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                required
              />
            </div>

            <div className="vh-field">
              <label htmlFor="checkout-country">Country</label>
              <input
                id="checkout-country"
                name="country"
                type="text"
                className="vh-input"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="vh-checkout-divider" />

          <div className="vh-field">
            <p className="vh-field__label">Payment Method</p>
            <p className="vh-payment-note">Sepolia ETH is the live checkout option for this product.</p>
          </div>

          <div className="vh-field">
            <p className="vh-field__label">Amount View</p>
            <div className="vh-display-toggle">
              <button
                type="button"
                className={`vh-display-toggle__button ${amountMode === "php" ? "vh-display-toggle__button--active" : ""}`}
                onClick={() => setAmountMode("php")}
              >
                PHP
              </button>
              <button
                type="button"
                className={`vh-display-toggle__button ${amountMode === "eth" ? "vh-display-toggle__button--active" : ""}`}
                onClick={() => setAmountMode("eth")}
              >
                ETH
              </button>
            </div>
          </div>

          <div className="vh-field">
            <label htmlFor="checkout-entered-amount">
              {amountMode === "php" ? "Entered Payment Amount (PHP)" : "Entered Payment Amount (ETH)"}
            </label>
            <input
              id="checkout-entered-amount"
              name="enteredAmount"
              type="number"
              min={amountMode === "php" ? "1" : "0.0000001"}
              step={amountMode === "php" ? "0.01" : "0.0000001"}
              className="vh-input"
              placeholder={amountMode === "php" ? pricing?.subtotalPhp || "12500.00" : pricing?.requiredEth || "0.010000"}
              value={enteredAmount}
              onChange={(event) => setEnteredAmount(event.target.value)}
              required
            />
          </div>

          <div className="vh-field">
            <label htmlFor="checkout-notes">Note</label>
            <textarea
              id="checkout-notes"
              name="notes"
              className="vh-textarea"
              placeholder="Optional note for this order"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {reviewMode && pricing && resolvedInput?.ok ? (
            <div className="vh-status">
              <strong>Review your order</strong>
              <br />
              Product: {pricing.product.name}
              <br />
              Size: {selectedSize}
              <br />
              Quantity: {pricing.quantity}
              <br />
              Product Total: {pricing.subtotalPhpLabel}
              <br />
              Required: {pricing.requiredEthLabel}
              <br />
              Entered amount: {resolvedInput.enteredAmountLabel}
              <br />
              You will send: {resolvedInput.payableEthAmount} ETH
              <br />
              Customer: {customerName}
              <br />
              Phone: {phone}
              <br />
              Shipping: {shippingAddress}
              <br />
              {notes ? `Notes: ${notes}` : "No additional notes."}
            </div>
          ) : null}

          {reviewMode ? (
            <label className="vh-checkout-confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                required={reviewMode}
              />
              <span>I confirm these order details are correct before opening the Sepolia payment in MetaMask.</span>
            </label>
          ) : null}

          {quoteError ? <div className="vh-status vh-status--error">{quoteError}</div> : null}
          {error ? <div className="vh-status vh-status--error">{error}</div> : null}

          {submission ? (
            <div className={`vh-status ${submission.verificationStatus === "paid" ? "vh-status--success" : ""}`}>
              {submission.verificationStatus === "paid" ? "Sepolia payment confirmed." : "Order created and waiting for payment confirmation."}
              <br />
              Order Number: {submission.orderNumber || submission.orderId}
              <br />
              Product: {submission.productName} · Qty {submission.quantity}
              <br />
              Total: {submission.subtotalPhpLabel}
              <br />
              Required ETH: {submission.requiredEthLabel}
              <br />
              Sending: {submission.payableEthLabel}
              <br />
              Payment Attempt: {submission.paymentId}
              <br />
              Recipient: {submission.recipientWalletAddress || "Not set"}
              <br />
              Confirmation Email: {submission.confirmationEmailStatus}
              <br />
              Status: {submission.message}
              <div className="vh-actions">
                <Link className="vh-button vh-button--ghost" href="/dashboard">
                  View Dashboard
                </Link>
              </div>
            </div>
          ) : null}

          <div className="vh-checkout-action-row">
            {!reviewMode ? (
              <button type="button" className="action-button action-button--black action-button--lg" disabled={loading || quoteLoading || !pricing} onClick={handleReview}>
                Continue To Review
              </button>
            ) : (
              <>
                <button type="submit" className="action-button action-button--black action-button--lg" disabled={loading || !pricing || !resolvedInput?.ok}>
                  {loading ? "Processing..." : "Pay With MetaMask"}
                </button>
                <button
                  type="button"
                  className="action-button action-button--lg"
                  disabled={loading}
                  onClick={() => {
                    setReviewMode(false);
                    setConfirmed(false);
                    setError("");
                  }}
                >
                  Edit Details
                </button>
              </>
            )}
          </div>
        </form>

        <aside className="storefront-app-card">
          <h2 className="h4 u-margin-b--lg">Order Summary</h2>

          <div className="storefront-app-list">
            <div className="storefront-app-summary-row">
              <span>
                {selectedProduct?.brand} {selectedProduct?.name} x{quantity}
              </span>
              <strong>{subtotalLabel}</strong>
            </div>
          </div>

          <div className="storefront-app-summary u-margin-t--xl">
            <div className="storefront-app-summary-row">
              <span>Subtotal</span>
              <strong>{subtotalLabel}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Shipping</span>
              <strong>{shippingLabel}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Total</span>
              <strong>{totalLabel}</strong>
            </div>
          </div>

          <div className="vh-checkout-summary-extra">
            {selectedProduct ? (
              <div className="storefront-app-summary-row">
                <span>Size</span>
                <strong>{selectedSize}</strong>
              </div>
            ) : null}
            <div className="storefront-app-summary-row">
              <span>Payment Method</span>
              <strong>ETH</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Required ETH</span>
              <strong>{pricing?.requiredEthLabel || "--"}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Rate</span>
              <strong>{pricing?.phpPerEthLabel || "--"}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Quote Updated</span>
              <strong>{formatQuoteTime(pricing?.quoteUpdatedAt || null)}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Quote Source</span>
              <strong>{pricing?.quoteSource || "--"}</strong>
            </div>
            <p className="vh-payment-note">
              Checkout is now scoped to items added through My Bag. The live crypto payment flow remains unchanged underneath.
            </p>
          </div>
        </aside>
      </section>
      ) : null}
    </div>
  );
}
