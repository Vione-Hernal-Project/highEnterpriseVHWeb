"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { getCatalogPriceLabel, getCatalogProductPageHref, type CatalogProduct } from "@/lib/catalog";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { formatOrderItemLine } from "@/lib/order-items";
import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";
import { getDefaultCheckoutInput, resolveCheckoutInput, type CheckoutAmountMode } from "@/lib/payments/checkout";
import { getCheckoutShippingQuote, getShippingMethodLabel, resolveShippingPostalAutofill, type ShippingMethodCode } from "@/lib/shipping";
import { getWeb3ErrorMessage } from "@/lib/web3/errors";
import { sendCryptoPayment, validateWalletCanPay } from "@/lib/web3/payments";
import { readBagItems, subscribeToStorefrontState, writeBagItems, type StorefrontBagItem } from "@/lib/storefront/storage";

type Props = {
  customerEmail: string;
  products: CatalogProduct[];
};

type CheckoutBagLineItem = StorefrontBagItem & {
  brand: string;
  image: string;
  name: string;
  pricePhpCents: number;
  productHref: string;
};

type PricingPreviewItem = {
  product: CatalogProduct;
  selectedSize: string;
  quantity: number;
  lineTotalPhpCents: number;
  lineTotalPhp: string;
  lineTotalPhpLabel: string;
};

type PricingPreview = {
  items: PricingPreviewItem[];
  itemCount: number;
  totalQuantity: number;
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  shippingOptions: Array<{
    code: ShippingMethodCode;
    label: string;
    feePhpCents: number;
    feePhp: string;
    feeLabel: string;
    description: string;
  }>;
  shippingFeePhpCents: number | null;
  shippingFeePhp: string | null;
  shippingFeeLabel: string;
  shippingMethodCode: ShippingMethodCode | null;
  shippingMethodLabel: string | null;
  shippingZone: string | null;
  shippingZoneLabel: string | null;
  shippingMessage: string;
  freeShippingApplied: boolean;
  totalPhpCents: number;
  totalPhp: string;
  totalPhpLabel: string;
  normalizedShippingAddress: {
    address1: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    zone: string | null;
    zoneLabel: string | null;
  };
  isShippingResolved: boolean;
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
  txHash: string | null;
  walletAddress: string | null;
  itemCount: number;
  totalQuantity: number;
  itemLines: string[];
  subtotalPhpLabel: string;
  shippingFeeLabel: string;
  shippingMethodLabel: string | null;
  shippingZoneLabel: string | null;
  totalPhpLabel: string;
  requiredEthLabel: string;
  payableEthLabel: string;
  recipientWalletAddress: string | null;
  confirmationEmailStatus: string;
  verificationStatus: "paid" | "pending" | "failed";
  message: string;
};

type VerifyPaymentPayload = {
  error?: string;
  message?: string;
  verificationStatus?: "paid" | "pending" | "invalid";
  order?: {
    confirmation_email_status?: string;
  };
};

const AUTO_VERIFY_INTERVAL_MS = 8000;
const AUTO_VERIFY_MAX_ATTEMPTS = 10;

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

async function rollbackPendingOrder(orderId: string) {
  const response = await fetch("/api/orders/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  const payload = await readJsonSafely<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Unable to roll back the pending order."));
  }
}

export function MockCheckoutForm({ customerEmail, products }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [bagItems, setBagItems] = useState<StorefrontBagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [shippingMessage, setShippingMessage] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Philippines");
  const [shippingMethodCode, setShippingMethodCode] = useState<ShippingMethodCode>("standard");
  const [paymentMethod] = useState<"eth">("eth");
  const [amountMode, setAmountMode] = useState<CheckoutAmountMode>("php");
  const [enteredAmount, setEnteredAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [submission, setSubmission] = useState<SubmissionState | null>(null);
  const autoVerifyTimerRef = useRef<number | null>(null);
  const autoVerifyAttemptRef = useRef(0);
  const autoVerifyInFlightRef = useRef(false);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    function syncBag() {
      setBagItems(readBagItems());
    }

    syncBag();

    return subscribeToStorefrontState(syncBag);
  }, []);

  useEffect(() => {
    if (!submission || submission.verificationStatus !== "pending" || !submission.txHash) {
      if (autoVerifyTimerRef.current !== null) {
        window.clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const clearAutoVerifyTimer = () => {
      if (autoVerifyTimerRef.current !== null) {
        window.clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
    };

    const runAutoVerify = async () => {
      if (cancelled || autoVerifyInFlightRef.current) {
        return;
      }

      if (autoVerifyAttemptRef.current >= AUTO_VERIFY_MAX_ATTEMPTS) {
        clearAutoVerifyTimer();
        setSubmission((current) =>
          current && current.paymentId === submission.paymentId
            ? {
                ...current,
                message:
                  "Transaction submitted. Still waiting for Ethereum Mainnet confirmation. If this takes unusually long, check MetaMask for a dropped or replaced transaction.",
              }
            : current,
        );
        return;
      }

      autoVerifyAttemptRef.current += 1;
      autoVerifyInFlightRef.current = true;

      try {
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentId: submission.paymentId,
            txHash: submission.txHash,
            walletAddress: submission.walletAddress || undefined,
          }),
        });

        const payload = await readJsonSafely<VerifyPaymentPayload>(response);

        if (cancelled) {
          return;
        }

        if (response.status === 202) {
          setError("");
          setSubmission((current) =>
            current && current.paymentId === submission.paymentId
              ? {
                  ...current,
                  message: payload?.message || "Transaction submitted. Waiting for Ethereum Mainnet confirmation.",
                }
              : current,
          );
          clearAutoVerifyTimer();
          autoVerifyTimerRef.current = window.setTimeout(runAutoVerify, AUTO_VERIFY_INTERVAL_MS);
          return;
        }

        if (!response.ok) {
          clearAutoVerifyTimer();

          if (payload?.verificationStatus === "invalid") {
            setSubmission((current) =>
              current && current.paymentId === submission.paymentId
                ? {
                    ...current,
                    verificationStatus: "failed",
                    message: payload.error || "The payment attempt needs attention before the order can be completed.",
                  }
                : current,
            );
          }

          setError(getResponseErrorMessage(payload, "The on-chain payment could not be verified yet."));
          return;
        }

        clearAutoVerifyTimer();
        setError("");
        setSubmission((current) =>
          current && current.paymentId === submission.paymentId
            ? {
                ...current,
                verificationStatus: "paid",
                confirmationEmailStatus: payload?.order?.confirmation_email_status || current.confirmationEmailStatus,
                message: payload?.message || "Ethereum Mainnet payment confirmed.",
              }
            : current,
        );
      } catch (autoVerifyError) {
        clearAutoVerifyTimer();
        setError(getErrorMessage(autoVerifyError, "Unable to verify the payment automatically right now."));
      } finally {
        autoVerifyInFlightRef.current = false;
      }
    };

    autoVerifyAttemptRef.current = 0;
    void runAutoVerify();

    return () => {
      cancelled = true;
      clearAutoVerifyTimer();
      autoVerifyInFlightRef.current = false;
    };
  }, [submission?.paymentId, submission?.txHash, submission?.verificationStatus, submission?.walletAddress]);

  const checkoutItems = useMemo(
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
          } satisfies CheckoutBagLineItem;
        })
        .filter((item): item is CheckoutBagLineItem => Boolean(item)),
    [bagItems, productMap],
  );

  const pricingRequestItems = useMemo(
    () =>
      checkoutItems.map((item) => ({
        productId: item.productId,
        selectedSize: item.size,
        quantity: item.quantity,
      })),
    [checkoutItems],
  );

  const checkoutSignature = useMemo(
    () => pricingRequestItems.map((item) => `${item.productId}:${item.selectedSize}:${item.quantity}`).join("|"),
    [pricingRequestItems],
  );

  const shippingAddress = useMemo(
    () => buildShippingAddress([address1, city, province, postalCode, country]),
    [address1, city, province, postalCode, country],
  );
  const postalAutofill = useMemo(() => resolveShippingPostalAutofill({ postalCode, country }), [country, postalCode]);
  const localShippingPreview = useMemo(
    () =>
      getCheckoutShippingQuote({
        merchandiseSubtotalPhpCents: checkoutItems.reduce((total, item) => total + item.pricePhpCents * item.quantity, 0),
        address: {
          address1,
          city,
          province,
          postalCode,
          country,
        },
        selectedMethodCode: shippingMethodCode,
      }),
    [address1, checkoutItems, city, country, postalCode, province, shippingMethodCode],
  );

  useEffect(() => {
    if (postalAutofill.status === "matched") {
      setCity(postalAutofill.city);
      setProvince(postalAutofill.province);

      if (!country || country === "Philippines") {
        setCountry(postalAutofill.country);
      }

      return;
    }

    setCity("");
    setProvince("");
  }, [country, postalAutofill.city, postalAutofill.country, postalAutofill.postalCode, postalAutofill.province, postalAutofill.status]);

  useEffect(() => {
    if (submission) {
      return;
    }

    setReviewMode(false);
    setConfirmed(false);
    setError("");
  }, [checkoutSignature, submission]);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      if (!pricingRequestItems.length) {
        if (!submission) {
          setPricing(null);
          setEnteredAmount("");
          setQuoteError("");
          setShippingMessage("");
        }
        return;
      }

      setQuoteLoading(true);
      setQuoteError("");

      try {
        const response = await fetch("/api/quotes/eth-php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: pricingRequestItems,
            shippingMethodCode,
            shippingAddress: {
              address1,
              city,
              province,
              postalCode,
              country,
            },
          }),
        });
        const payload = await readJsonSafely<{ error?: string; pricing?: PricingPreview }>(response);

        if (!response.ok || !payload?.pricing) {
          throw new Error(getResponseErrorMessage(payload, "Unable to load the current ETH quote."));
        }

        if (cancelled) {
          return;
        }

        setPricing(payload.pricing);
        setShippingMessage(payload.pricing.shippingMessage);
        if (payload.pricing.shippingMethodCode && payload.pricing.shippingMethodCode !== shippingMethodCode) {
          setShippingMethodCode(payload.pricing.shippingMethodCode);
        }
        setEnteredAmount(getDefaultCheckoutInput(amountMode, payload.pricing));
      } catch (quoteLoadError) {
        if (cancelled) {
          return;
        }

        setPricing(null);
        setShippingMessage("");
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
  }, [address1, amountMode, city, country, postalCode, pricingRequestItems, province, shippingMethodCode, submission]);

  const resolvedInput = pricing
    ? resolveCheckoutInput({
        amountMode,
        enteredAmount,
        pricing,
      })
    : null;

  const localSubtotalPhpCents = checkoutItems.reduce((total, item) => total + item.pricePhpCents * item.quantity, 0);
  const subtotalLabel = pricing?.subtotalPhpLabel || formatPhpCurrencyFromCents(localSubtotalPhpCents);
  const shippingLabel = pricing?.shippingFeeLabel || localShippingPreview.shippingFeeLabel;
  const totalLabel = pricing?.totalPhpLabel || formatPhpCurrencyFromCents(localSubtotalPhpCents + (localShippingPreview.shippingFeePhpCents || 0));

  function resetForm() {
    setCustomerName("");
    setPhone("");
    setAddress1("");
    setCity("");
    setProvince("");
    setPostalCode("");
    setCountry("Philippines");
    setShippingMethodCode("standard");
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

    if (!pricing.isShippingResolved || !pricing.shippingMethodCode) {
      setError(pricing.shippingMessage || "Shipping will be calculated after completing your address.");
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

    if (!pricingRequestItems.length) {
      setError("Your bag is empty.");
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
          items: pricingRequestItems,
          customerName,
          phone,
          shippingAddressLine1: address1,
          shippingCity: city,
          shippingProvince: province,
          shippingPostalCode: postalCode,
          shippingCountry: country,
          shippingMethodCode,
          enteredAmount,
          amountMode,
          paymentMethod,
          payerWalletAddress: preparedWallet.walletAddress,
          notes,
          confirmed,
        }),
      });

      const createOrderPayload = await readJsonSafely<{
        error?: string;
        order: { id: string; order_number: string | null; confirmation_email_status: string };
        payment: { id: string; payment_method: string; recipient_address?: string | null; wallet_address?: string | null };
        pricing: {
          subtotalPhpLabel: string;
          shippingFeeLabel: string;
          shippingMethodCode: ShippingMethodCode | null;
          shippingMethodLabel: string | null;
          shippingZoneLabel: string | null;
          totalPhpLabel: string;
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

      const itemLines = pricing.items.map((item) =>
        formatOrderItemLine({
          product_name: item.product.name,
          product_brand: item.product.brand,
          selected_size: item.selectedSize,
          quantity: item.quantity,
        }),
      );

      const orderSnapshot = {
        orderId: createOrderPayload.order.id,
        orderNumber: createOrderPayload.order.order_number,
        paymentId: createOrderPayload.payment.id,
        paymentMethod: createOrderPayload.payment.payment_method,
        txHash: null,
        walletAddress: createOrderPayload.payment.wallet_address || preparedWallet.walletAddress,
        itemCount: pricing.itemCount,
        totalQuantity: pricing.totalQuantity,
        itemLines,
        subtotalPhpLabel: createOrderPayload.pricing.subtotalPhpLabel,
        shippingFeeLabel: createOrderPayload.pricing.shippingFeeLabel,
        shippingMethodLabel: createOrderPayload.pricing.shippingMethodLabel,
        shippingZoneLabel: createOrderPayload.pricing.shippingZoneLabel,
        totalPhpLabel: createOrderPayload.pricing.totalPhpLabel,
        requiredEthLabel: createOrderPayload.pricing.requiredEthLabel,
        payableEthLabel: createOrderPayload.pricing.payableEthLabel,
        recipientWalletAddress: createOrderPayload.payment.recipient_address || createOrderPayload.recipientWalletAddress || null,
        confirmationEmailStatus: createOrderPayload.order.confirmation_email_status,
      };

      try {
        const walletPayment = await sendCryptoPayment({
          amount: createOrderPayload.pricing.payableEthAmount,
          paymentMethod,
          preparedWallet,
          recipientAddress: orderSnapshot.recipientWalletAddress,
          expectedWalletAddress: orderSnapshot.walletAddress,
        });

        writeBagItems([]);

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
            txHash: walletPayment.txHash,
            walletAddress: walletPayment.walletAddress,
            verificationStatus: "pending",
            message: verifyPayload?.message || "Transaction submitted. Waiting for Ethereum Mainnet confirmation.",
          });
          resetForm();
          return;
        }

        if (!verifyResponse.ok) {
          const invalidVerification = verifyPayload?.verificationStatus === "invalid";

          setSubmission({
            ...orderSnapshot,
            txHash: walletPayment.txHash,
            walletAddress: walletPayment.walletAddress,
            verificationStatus: invalidVerification ? "failed" : "pending",
            message: invalidVerification
              ? verifyPayload?.error || "Order created, but the payment attempt needs attention before it can be confirmed."
              : "Order created. Payment is still pending and can be rechecked from the dashboard.",
          });
          setError(
            `${getResponseErrorMessage(verifyPayload, "The on-chain payment could not be verified yet.")} The order remains pending.`,
          );
          resetForm();
          return;
        }

        setSubmission({
          ...orderSnapshot,
          txHash: walletPayment.txHash,
          walletAddress: walletPayment.walletAddress,
          verificationStatus: "paid",
          message: verifyPayload?.message || "Ethereum Mainnet payment confirmed.",
        });
        resetForm();
      } catch (walletError) {
        let rollbackMessage = "";

        try {
          await rollbackPendingOrder(orderSnapshot.orderId);
        } catch (rollbackError) {
          rollbackMessage = ` ${getErrorMessage(rollbackError, "The temporary order could not be rolled back automatically.")}`;
        }

        setError(
          `${getWeb3ErrorMessage(walletError, "MetaMask payment was not completed.")} Your bag was kept so you can try again.${rollbackMessage}`,
        );
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create the order."));
    } finally {
      setLoading(false);
    }
  }

  if (!checkoutItems.length && !submission) {
    return (
      <div className="vh-checkout-shell">
        <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/bag">My Bag</Link>
          <span>/</span>
          <span>Checkout</span>
        </nav>

        <section className="storefront-app-view">
          <div className="storefront-app-empty">
            <p className="u-margin-b--lg">Checkout is available once you add items to your bag.</p>
            <Link className="vh-button" href="/bag">
              Go To My Bag
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="vh-checkout-shell">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/bag">My Bag</Link>
        <span>/</span>
        <span>Checkout</span>
      </nav>

      <section className="storefront-app-grid vh-checkout-storefront-grid">
        <div className="storefront-app-card">
          {!submission ? (
            <form ref={formRef} onSubmit={handleSubmit}>
              <h1 className="h2 u-margin-b--sm">Checkout</h1>
              <p className="vh-payment-note">
                Review {checkoutItems.length} bag item{checkoutItems.length === 1 ? "" : "s"} and complete one payment for the full order.
              </p>

              <div className="vh-actions">
                <Link className="vh-button vh-button--ghost" href="/bag">
                  Edit In My Bag
                </Link>
              </div>

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
                  name="shippingAddressLine1"
                  type="text"
                  className="vh-input"
                  value={address1}
                  onChange={(event) => setAddress1(event.target.value)}
                  autoComplete="street-address"
                  required
                />
                <p className="vh-payment-note">Street, house number, building, or unit must still be entered manually.</p>
              </div>

              <div className="vh-checkout-field-grid">
                <div className="vh-field">
                  <label htmlFor="checkout-city">City</label>
                  <input
                    id="checkout-city"
                    name="shippingCity"
                    type="text"
                    className="vh-input"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    required
                  />
                </div>

                <div className="vh-field">
                  <label htmlFor="checkout-province">Province / State</label>
                  <input
                    id="checkout-province"
                    name="shippingProvince"
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
                    name="shippingPostalCode"
                    type="text"
                    className="vh-input"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    required
                  />
                </div>

                <div className="vh-field">
                  <label htmlFor="checkout-country">Country</label>
                  <input
                    id="checkout-country"
                    name="shippingCountry"
                    type="text"
                    className="vh-input"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="vh-field">
                <p className="vh-payment-note">
                  {postalAutofill.status === "matched"
                    ? `Address help: ${[
                        postalAutofill.city || null,
                        postalAutofill.province || null,
                        postalAutofill.country || null,
                      ]
                        .filter(Boolean)
                        .join(", ")}${postalAutofill.zoneLabel ? ` · ${postalAutofill.zoneLabel}` : ""}`
                    : `Address help: ${postalAutofill.message}`}
                </p>
              </div>

              <div className="vh-field">
                <label htmlFor="checkout-shipping-method">Shipping Option</label>
                <select
                  id="checkout-shipping-method"
                  name="shippingMethodCode"
                  className="vh-input"
                  value={shippingMethodCode}
                  onChange={(event) => setShippingMethodCode(event.target.value === "express" ? "express" : "standard")}
                  disabled={!localShippingPreview.isResolved && !pricing?.isShippingResolved}
                  required
                >
                  {(pricing?.shippingOptions?.length ? pricing.shippingOptions : localShippingPreview.shippingOptions).length ? (
                    (pricing?.shippingOptions?.length ? pricing.shippingOptions : localShippingPreview.shippingOptions).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label} · {option.feeLabel}
                      </option>
                    ))
                  ) : (
                    <option value="standard">Shipping will be calculated after completing your address.</option>
                  )}
                </select>
                <p className="vh-payment-note">{shippingMessage || localShippingPreview.message}</p>
              </div>

              <div className="vh-checkout-divider" />

              <div className="vh-field">
                <p className="vh-field__label">Payment Method</p>
                <p className="vh-payment-note">ETH is the live checkout option for this order.</p>
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
                  placeholder={amountMode === "php" ? pricing?.totalPhp || "12500.00" : pricing?.requiredEth || "0.010000"}
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
                  Items:
                  <br />
                  {pricing.items.map((item) => (
                    <span key={`${item.product.id}-${item.selectedSize}`}>
                      {formatOrderItemLine({
                        product_name: item.product.name,
                        product_brand: item.product.brand,
                        selected_size: item.selectedSize,
                        quantity: item.quantity,
                      })}
                      <br />
                    </span>
                  ))}
                  Total quantity: {pricing.totalQuantity}
                  <br />
                  Subtotal: {pricing.subtotalPhpLabel}
                  <br />
                  Shipping: {pricing.shippingMethodLabel || getShippingMethodLabel(shippingMethodCode)} · {pricing.shippingFeeLabel}
                  <br />
                  Order Total: {pricing.totalPhpLabel}
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
                  Zone: {pricing.shippingZoneLabel || "Pending"}
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
                  <span>I confirm these order details are correct before opening the payment in MetaMask.</span>
                </label>
              ) : null}

              {quoteError ? <div className="vh-status vh-status--error">{quoteError}</div> : null}
              {error ? <div className="vh-status vh-status--error">{error}</div> : null}

              <div className="vh-checkout-action-row">
                {!reviewMode ? (
                  <button
                    type="button"
                    className="action-button action-button--black action-button--lg"
                    disabled={loading || quoteLoading || !pricing}
                    onClick={handleReview}
                  >
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
          ) : (
            <>
              <h1 className="h2 u-margin-b--lg">
                {submission.verificationStatus === "paid"
                  ? "Payment Confirmed"
                  : submission.verificationStatus === "failed"
                    ? "Payment Needs Attention"
                    : "Order Created"}
              </h1>
              {error ? <div className="vh-status vh-status--error">{error}</div> : null}
              <div
                className={`vh-status ${
                  submission.verificationStatus === "paid"
                    ? "vh-status--success"
                    : submission.verificationStatus === "failed"
                      ? "vh-status--error"
                      : ""
                }`}
              >
                {submission.verificationStatus === "paid"
                  ? "Ethereum Mainnet payment confirmed."
                  : submission.verificationStatus === "failed"
                    ? "Order created, but the payment attempt still needs attention."
                    : "Order created and waiting for payment confirmation."}
                <br />
                Order Number: {submission.orderNumber || submission.orderId}
                <br />
                Items: {submission.itemCount}
                <br />
                Total quantity: {submission.totalQuantity}
                <br />
                Subtotal: {submission.subtotalPhpLabel}
                <br />
                Shipping: {submission.shippingMethodLabel || "Shipping"} · {submission.shippingFeeLabel}
                <br />
                Total: {submission.totalPhpLabel}
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
              </div>
              <div className="vh-actions">
                <Link className="vh-button vh-button--ghost" href="/dashboard">
                  View Dashboard
                </Link>
                <Link className="vh-button" href="/shop">
                  Continue Shopping
                </Link>
              </div>
            </>
          )}
        </div>

        <aside className="storefront-app-card">
          <h2 className="h4 u-margin-b--lg">Order Summary</h2>

          <div className="storefront-app-list">
            {(submission ? submission.itemLines : checkoutItems.map((item) => formatOrderItemLine({
              product_name: item.name,
              product_brand: item.brand,
              selected_size: item.size,
              quantity: item.quantity,
            }))).map((line, index) => {
              const checkoutItem = checkoutItems[index];

              return (
                <div key={`${line}-${index}`} className="storefront-app-summary-row">
                  <span>
                    {checkoutItem && !submission ? (
                      <Link href={checkoutItem.productHref}>
                        {line}
                      </Link>
                    ) : (
                      line
                    )}
                  </span>
                  <strong>{checkoutItem && !submission ? getCatalogPriceLabel(checkoutItem.pricePhpCents * checkoutItem.quantity) : ""}</strong>
                </div>
              );
            })}
          </div>

          <div className="storefront-app-summary u-margin-t--xl">
            <div className="storefront-app-summary-row">
              <span>Total Quantity</span>
              <strong>{submission?.totalQuantity ?? pricing?.totalQuantity ?? checkoutItems.reduce((total, item) => total + item.quantity, 0)}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Subtotal</span>
              <strong>{submission?.subtotalPhpLabel ?? subtotalLabel}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Shipping</span>
              <strong>{submission?.shippingFeeLabel ?? shippingLabel}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Total</span>
              <strong>{submission?.totalPhpLabel ?? totalLabel}</strong>
            </div>
          </div>

          <div className="vh-checkout-summary-extra">
            <div className="storefront-app-summary-row">
              <span>Shipping Method</span>
              <strong>{submission?.shippingMethodLabel ?? pricing?.shippingMethodLabel ?? getShippingMethodLabel(shippingMethodCode)}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Shipping Zone</span>
              <strong>{submission?.shippingZoneLabel ?? pricing?.shippingZoneLabel ?? localShippingPreview.shippingZoneLabel ?? "Pending"}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Payment Method</span>
              <strong>ETH</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Required ETH</span>
              <strong>{submission?.requiredEthLabel ?? pricing?.requiredEthLabel ?? "--"}</strong>
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
              {shippingMessage || pricing?.shippingMessage || localShippingPreview.message}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
