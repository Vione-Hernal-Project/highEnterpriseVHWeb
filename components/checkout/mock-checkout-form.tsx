"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { getCatalogPriceLabel, getCatalogProductPageHref, type CatalogProduct } from "@/lib/catalog";
import { CHECKOUT_SETTINGS_SYNC_STORAGE_KEY } from "@/lib/checkout-settings-sync";
import {
  getEnabledPaymentMethodOptions,
  isPaymentMethodEnabled,
  type CheckoutAvailabilitySettings,
} from "@/lib/checkout-availability";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { formatOrderItemLine } from "@/lib/order-items";
import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";
import { getDefaultCheckoutInput, resolveCheckoutInput, type CheckoutAmountMode } from "@/lib/payments/checkout";
import { readMarketingAttribution } from "@/lib/marketing/attribution";
import {
  getPaymentMethodConfig,
  getPaymentMethodLabel,
  getPaymentMethodNetworkName,
  isPaymentMethodValue,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/payments/options";
import { sendSolanaPayment, validateSolanaWalletCanPay } from "@/lib/solana/payments";
import { getCheckoutShippingQuote, getShippingMethodLabel, resolveShippingPostalAutofill, type ShippingMethodCode } from "@/lib/shipping";
import { getWeb3ErrorMessage } from "@/lib/web3/errors";
import { sendCryptoPayment, validateWalletCanPay } from "@/lib/web3/payments";
import { readBagItems, subscribeToStorefrontState, writeBagItems, type StorefrontBagItem } from "@/lib/storefront/storage";
import {
  isPreciseGeocodeResult,
  useGeocodedAddress,
  type GeocodeAddressComponents,
  type GeocodeResult,
} from "@/components/map/use-geocoded-address";
import { VhInteractiveMap, type VhMapMarker } from "@/components/map/vh-interactive-map";
import { AddressAutocomplete, type AddressSuggestion } from "@/components/map/address-autocomplete";
import { Crosshair } from "lucide-react";

type Props = {
  customerEmail: string;
  products: CatalogProduct[];
  checkoutSettings: CheckoutAvailabilitySettings;
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
  couponId: string | null;
  couponCode: string | null;
  couponLabel: string | null;
  couponMessage: string | null;
  discountPhpCents: number;
  discountPhp: string;
  discountPhpLabel: string;
  productDiscountPhpCents: number;
  shippingDiscountPhpCents: number;
  totalBeforeDiscountPhpCents: number;
  taxRuleId: string | null;
  taxLabel: string | null;
  taxRatePercent: number;
  taxableAmountPhpCents: number;
  taxableAmountPhp: string;
  taxableAmountPhpLabel: string;
  taxPhpCents: number;
  taxPhp: string;
  taxPhpLabel: string;
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
  phpPerCrypto: number;
  phpPerCryptoLabel: string;
  requiredCryptoAmount: string;
  requiredCryptoLabel: string;
  cryptoSymbol: string;
  cryptoDecimals: number;
  quoteSource: string;
  quoteUpdatedAt: string | null;
  estimatedUsdValue: string;
  estimatedUsdLabel: string;
  usdPhpRate: number | null;
  coingeckoCryptoUsdPrice: number | null;
  binanceCryptoUsdPrice: number | null;
  priceDifferencePercent: number | null;
  slippageBufferPercent: number;
  slippageBufferLabel: string;
  baseCryptoAmount: string;
  baseCryptoLabel: string;
  slippageBufferAmount: string;
  slippageBufferAmountLabel: string;
  networkFeeEstimateAmount: string;
  networkFeeEstimateLabel: string;
  networkFeeEstimateSymbol: string;
  estimatedTotalLabel: string;
  quoteExpiresAt: string;
  quoteTtlSeconds: number;
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
  couponCode: string | null;
  couponLabel: string | null;
  discountPhpLabel: string | null;
  taxLabel: string | null;
  taxPhpLabel: string | null;
  shippingMethodLabel: string | null;
  shippingZoneLabel: string | null;
  totalPhpLabel: string;
  requiredEthLabel: string;
  payableEthLabel: string;
  cryptoSymbol: string;
  estimatedUsdLabel: string | null;
  baseCryptoLabel: string | null;
  slippageBufferLabel: string | null;
  slippageBufferAmountLabel: string | null;
  networkFeeEstimateLabel: string | null;
  estimatedTotalLabel: string | null;
  quoteExpiresAt: string | null;
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
const PENDING_CHECKOUT_PAYMENT_STORAGE_KEY = "vionehernal_pending_checkout_payment";
const PENDING_CHECKOUT_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_PAYMENT_METHOD_STORAGE_KEY = "vionehernal_checkout_payment_method";
const CHECKOUT_QUOTE_DEBOUNCE_MS = 350;
const CRYPTO_NETWORK_FEE_NOTE =
  "Crypto payments include network processing fees required by the blockchain. These fees are not charged by Vione Hernal and go directly to the network. Final fees are confirmed in your wallet before payment.";

function formatQuoteTime(value: string | null) {
  if (!value) {
    return "Live";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatQuoteCountdown(seconds: number | null) {
  if (seconds === null) {
    return "--";
  }

  if (seconds <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Friendly, approximate display of a crypto amount label (e.g. "5.609650732 SOL"
// → "≈ 5.6097 SOL"). Display-only — the exact amount the wallet charges is set
// from the locked server quote and is confirmed in the wallet.
function toFriendlyCrypto(label: string | null | undefined) {
  if (!label) {
    return "--";
  }

  const match = label.match(/^\s*([\d,]+(?:\.\d+)?)\s*(.*)$/);

  if (!match) {
    return label;
  }

  const value = Number(match[1].replace(/,/g, ""));

  if (!Number.isFinite(value)) {
    return label;
  }

  const rounded = (value >= 1 ? value.toFixed(4) : value.toFixed(6)).replace(/\.?0+$/, "");

  return `≈ ${rounded} ${match[2]}`.trim();
}

function buildShippingAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function readPendingCheckoutPayment() {
  try {
    const rawValue = window.localStorage.getItem(PENDING_CHECKOUT_PAYMENT_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as (SubmissionState & { expiresAt?: string }) | null;

    if (!parsed?.paymentId || !parsed.txHash || parsed.verificationStatus !== "pending") {
      window.localStorage.removeItem(PENDING_CHECKOUT_PAYMENT_STORAGE_KEY);
      return null;
    }

    if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(PENDING_CHECKOUT_PAYMENT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePendingCheckoutPayment(submission: SubmissionState) {
  if (!submission.txHash || submission.verificationStatus !== "pending") {
    return;
  }

  try {
    window.localStorage.setItem(
      PENDING_CHECKOUT_PAYMENT_STORAGE_KEY,
      JSON.stringify({
        ...submission,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + PENDING_CHECKOUT_PAYMENT_TTL_MS).toISOString(),
      }),
    );
  } catch {
    // Recovery storage is best-effort; the order remains recoverable from the dashboard.
  }
}

function clearPendingCheckoutPayment() {
  try {
    window.localStorage.removeItem(PENDING_CHECKOUT_PAYMENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function readStoredCheckoutPaymentMethod(): PaymentMethod | "" {
  try {
    const storedValue = window.localStorage.getItem(CHECKOUT_PAYMENT_METHOD_STORAGE_KEY);

    return isPaymentMethodValue(storedValue) ? storedValue : "";
  } catch {
    return "";
  }
}

function writeStoredCheckoutPaymentMethod(value: PaymentMethod) {
  try {
    window.localStorage.setItem(CHECKOUT_PAYMENT_METHOD_STORAGE_KEY, value);
  } catch {
    // Remembering the last chain is convenience-only.
  }
}

function getCheckoutPaymentPairLabel(option: (typeof PAYMENT_METHOD_OPTIONS)[number]) {
  const chainSymbol = option.network === "ethereum" ? "ETH" : "SOL";

  return option.kind === "native" ? chainSymbol : `${chainSymbol} / ${option.label}`;
}

function normalizeCheckoutCouponCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
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

export function MockCheckoutForm({ customerEmail, products, checkoutSettings: initialCheckoutSettings }: Props) {
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [amountMode, setAmountMode] = useState<CheckoutAmountMode>("php");
  const [enteredAmount, setEnteredAmount] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState(initialCheckoutSettings);
  const [submission, setSubmission] = useState<SubmissionState | null>(null);
  const [manualMapLocation, setManualMapLocation] = useState<GeocodeResult | null>(null);
  const [mapJumpTarget, setMapJumpTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [quoteRefreshNonce, setQuoteRefreshNonce] = useState(0);
  const [quoteNow, setQuoteNow] = useState(() => Date.now());
  const autoVerifyTimerRef = useRef<number | null>(null);
  const autoVerifyAttemptRef = useRef(0);
  const autoVerifyInFlightRef = useRef(false);
  const mapAddressUpdateRef = useRef(false);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const enabledPaymentOptions = useMemo(() => getEnabledPaymentMethodOptions(checkoutSettings), [checkoutSettings]);

  useEffect(() => {
    function syncBag() {
      setBagItems(readBagItems());
    }

    syncBag();

    return subscribeToStorefrontState(syncBag);
  }, []);

  useEffect(() => {
    const pendingPayment = readPendingCheckoutPayment();

    if (pendingPayment) {
      setSubmission(pendingPayment);
      return;
    }

    const storedPaymentMethod = readStoredCheckoutPaymentMethod();

    if (storedPaymentMethod && isPaymentMethodEnabled(checkoutSettings, storedPaymentMethod)) {
      setPaymentMethod(storedPaymentMethod);
    }
  }, [checkoutSettings]);

  useEffect(() => {
    let cancelled = false;

    async function syncCheckoutSettings() {
      try {
        const response = await fetch("/api/settings/checkout", { cache: "no-store" });
        const payload = await readJsonSafely<{ settings?: CheckoutAvailabilitySettings }>(response);

        if (!cancelled && response.ok && payload?.settings) {
          setCheckoutSettings(payload.settings);
        }
      } catch {
        // The server-rendered settings remain the fallback.
      }
    }

    syncCheckoutSettings();
    function handleCheckoutSettingsStorage(event: StorageEvent) {
      if (event.key === CHECKOUT_SETTINGS_SYNC_STORAGE_KEY) {
        void syncCheckoutSettings();
      }
    }

    window.addEventListener("focus", syncCheckoutSettings);
    window.addEventListener("storage", handleCheckoutSettingsStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncCheckoutSettings);
      window.removeEventListener("storage", handleCheckoutSettingsStorage);
    };
  }, []);

  useEffect(() => {
    if (paymentMethod && !isPaymentMethodEnabled(checkoutSettings, paymentMethod)) {
      const fallbackMethod = enabledPaymentOptions[0]?.value || "";

      setPaymentMethod(fallbackMethod);
      setPricing(null);
      setQuoteError(fallbackMethod ? "" : "No crypto payment methods are currently available.");
      setReviewMode(false);
      setConfirmed(false);

      if (fallbackMethod) {
        writeStoredCheckoutPaymentMethod(fallbackMethod);
      }
    }
  }, [checkoutSettings, enabledPaymentOptions, paymentMethod]);

  function handlePaymentMethodSelect(value: PaymentMethod) {
    if (!isPaymentMethodEnabled(checkoutSettings, value)) {
      return;
    }

    setPaymentMethod(value);
    writeStoredCheckoutPaymentMethod(value);
    setPricing(null);
    setQuoteError("");
    setShippingMessage("");
    setReviewMode(false);
    setConfirmed(false);
    setError("");
  }

  useEffect(() => {
    if (!submission) {
      return;
    }

    if (submission.verificationStatus === "pending" && submission.txHash) {
      writePendingCheckoutPayment(submission);
      return;
    }

    clearPendingCheckoutPayment();
  }, [submission]);

  useEffect(() => {
    if (!pricing?.quoteExpiresAt || submission) {
      return;
    }

    setQuoteNow(Date.now());
    const intervalId = window.setInterval(() => setQuoteNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, [pricing?.quoteExpiresAt, submission]);

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
                  `Transaction submitted. Still waiting for ${getPaymentMethodNetworkName(submission.paymentMethod)} confirmation.`,
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
                  message: payload?.message || `Transaction submitted. Waiting for ${getPaymentMethodNetworkName(submission.paymentMethod)} confirmation.`,
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
        writeBagItems([]);
        setSubmission((current) =>
          current && current.paymentId === submission.paymentId
            ? {
                ...current,
                verificationStatus: "paid",
                confirmationEmailStatus: payload?.order?.confirmation_email_status || current.confirmationEmailStatus,
                message: payload?.message || `${getPaymentMethodNetworkName(submission.paymentMethod)} payment confirmed.`,
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
  const streetWordCount = address1.trim().split(/\s+/).filter(Boolean).length;
  const streetLooksSpecific = streetWordCount >= 3 || /\d/.test(address1);
  const shouldResolveMapAddress = Boolean(
    streetLooksSpecific && address1.trim() && city.trim() && province.trim() && postalCode.trim().length >= 3 && country.trim(),
  );
  const {
    result: geocodedCheckoutAddress,
    loading: mapResolving,
    status: mapResolveStatus,
  } = useGeocodedAddress(shippingAddress, {
    debounceMs: 850,
    enabled: shouldResolveMapAddress && !manualMapLocation,
    structured: {
      street: address1,
      city,
      province,
      postalCode,
      country,
    },
  });
  const checkoutResolvedLocation = manualMapLocation || geocodedCheckoutAddress;
  const checkoutAutoLocationIsPrecise = isPreciseGeocodeResult(geocodedCheckoutAddress);
  const checkoutPreviewLocation =
    !manualMapLocation && geocodedCheckoutAddress && !checkoutAutoLocationIsPrecise
      ? { lat: geocodedCheckoutAddress.lat, lng: geocodedCheckoutAddress.lng }
      : undefined;
  const checkoutMapMarkers = useMemo<VhMapMarker[]>(() => {
    if (!shouldResolveMapAddress) {
      return [];
    }

    const location = checkoutResolvedLocation;

    if (!location || (!manualMapLocation && !checkoutAutoLocationIsPrecise)) {
      return [];
    }

    return [
      {
        id: "checkout-shipping-address",
        label: "Shipping address",
        description: shippingAddress,
        lat: location.lat,
        lng: location.lng,
      },
    ];
  }, [checkoutAutoLocationIsPrecise, checkoutResolvedLocation, manualMapLocation, shippingAddress, shouldResolveMapAddress]);
  const checkoutMapState = !shouldResolveMapAddress
    ? "empty"
    : mapResolving
      ? "loading"
      : checkoutMapMarkers.length
        ? "found"
        : mapResolveStatus === "not-found" || mapResolveStatus === "error"
          ? "not-found"
          : checkoutPreviewLocation
            ? "needs-pin"
          : "empty";
  const checkoutMapHeaderCopy =
    checkoutMapState === "loading"
      ? "Locating address"
      : checkoutMapState === "found"
        ? manualMapLocation
          ? "Pinned — drag the map to fine-tune"
          : "Drag the map so the pin sits on your spot"
        : checkoutMapState === "not-found"
          ? "Address not found"
          : checkoutMapState === "needs-pin"
            ? "Drag the map so the pin sits on your spot"
          : "Search or use your location to start";
  const checkoutMapEmptyTitle =
    checkoutMapState === "loading"
      ? "Locating address..."
      : checkoutMapState === "not-found"
        ? "Address not found yet."
        : checkoutMapState === "needs-pin"
          ? "Exact pin needed."
        : "Complete address to preview.";
  const checkoutMapEmptyCopy =
    checkoutMapState === "loading"
      ? "Checking the delivery location from the address you entered."
      : checkoutMapState === "not-found"
        ? "Try adding the street, barangay, city, province, postal code, and country."
        : checkoutMapState === "needs-pin"
          ? "This address only matched a general area. Right-click the exact gate, entrance, or drop-off point and choose Mark location."
        : "Enter a street, city, province, postal code, and country to preview the delivery location.";
  const selectedDeliveryLocation = checkoutMapMarkers.length ? checkoutResolvedLocation : null;
  const postalAutofill = useMemo(() => resolveShippingPostalAutofill({ postalCode, country }), [country, postalCode]);

  function applyResolvedAddressComponents(components: GeocodeAddressComponents | undefined) {
    if (!components) {
      return;
    }

    mapAddressUpdateRef.current = true;

    if (components.addressLine1) setAddress1(components.addressLine1);
    if (components.postalCode) setPostalCode(components.postalCode);
    if (components.country) setCountry(components.country);
    // City and province are derived from the postal code via the curated PH
    // autofill (reliable for Metro Manila). The geocoder often returns the wrong
    // values there (e.g. "Pasig" for both), so we don't overwrite them here.
  }

  async function markCheckoutLocation(location: { lat: number; lng: number }) {
    const fallbackLocation: GeocodeResult = {
      label: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
      lat: location.lat,
      lng: location.lng,
      provider: "manual",
      precision: "coordinate",
    };

    try {
      const response = await fetch(`/api/maps/reverse-geocode?lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}`);
      const payload = await readJsonSafely<{ result?: GeocodeResult | null }>(response);
      const resolvedLocation = payload?.result || fallbackLocation;

      // Keep the exact dropped coordinates for the pin; use reverse-geocode only
      // for the address text so the pin never snaps away from where it was placed.
      setManualMapLocation({ ...resolvedLocation, lat: location.lat, lng: location.lng });

      if (response.ok) {
        applyResolvedAddressComponents(resolvedLocation.components);
      }
    } catch {
      setManualMapLocation(fallbackLocation);
    }
  }

  function applyCheckoutSuggestion(suggestion: AddressSuggestion) {
    applyResolvedAddressComponents(suggestion.components);
    setManualMapLocation({
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
      placeId: suggestion.placeId,
      precision: suggestion.precision || "address",
      provider: "mapbox",
      components: suggestion.components,
    });
    setMapJumpTarget({ lat: suggestion.lat, lng: suggestion.lng });
  }

  function useCheckoutCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapJumpTarget(location);
        await markCheckoutLocation(location);
        setGeolocating(false);
      },
      () => {
        setGeolocating(false);
        setError("Could not get your location. Allow location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
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
        availabilitySettings: checkoutSettings,
      }),
    [address1, checkoutItems, checkoutSettings, city, country, postalCode, province, shippingMethodCode],
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
    if (mapAddressUpdateRef.current) {
      mapAddressUpdateRef.current = false;
      return;
    }

    setManualMapLocation(null);
  }, [shippingAddress]);

  // Center the map on the typed address only until the user has placed a pin
  // (suggestion / GPS / drag). Once a manual location exists, stop jumping so
  // dragging the pin is never reverted.
  useEffect(() => {
    if (!manualMapLocation && geocodedCheckoutAddress) {
      setMapJumpTarget({ lat: geocodedCheckoutAddress.lat, lng: geocodedCheckoutAddress.lng });
    }
  }, [manualMapLocation, geocodedCheckoutAddress?.lat, geocodedCheckoutAddress?.lng]);

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

    if (!pricingRequestItems.length || !paymentMethod) {
      if (!submission) {
        setPricing(null);
        setEnteredAmount("");
        setQuoteLoading(false);
        setQuoteError("");
        setShippingMessage("");
      }
      return;
    }

    async function loadPricing() {
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
            paymentMethod,
            couponCode: couponCode || null,
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
          throw new Error(getResponseErrorMessage(payload, `Unable to load the current ${getPaymentMethodLabel(paymentMethod)} quote.`));
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
        setQuoteError(getErrorMessage(quoteLoadError, `Unable to load the current ${getPaymentMethodLabel(paymentMethod)} quote.`));
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadPricing();
    }, CHECKOUT_QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [address1, amountMode, checkoutSettings, city, country, couponCode, paymentMethod, postalCode, pricingRequestItems, province, quoteRefreshNonce, shippingMethodCode, submission]);

  const resolvedInput = pricing
    ? resolveCheckoutInput({
        amountMode,
        enteredAmount,
        paymentMethod: paymentMethod || "evm_eth",
        pricing,
      })
    : null;

  const localSubtotalPhpCents = checkoutItems.reduce((total, item) => total + item.pricePhpCents * item.quantity, 0);
  const subtotalLabel = pricing?.subtotalPhpLabel || formatPhpCurrencyFromCents(localSubtotalPhpCents);
  const shippingLabel = pricing?.shippingFeeLabel || localShippingPreview.shippingFeeLabel;
  const totalLabel = pricing?.totalPhpLabel || formatPhpCurrencyFromCents(localSubtotalPhpCents + (localShippingPreview.shippingFeePhpCents || 0));
  const quoteSecondsRemaining = pricing?.quoteExpiresAt
    ? Math.max(0, Math.ceil((Date.parse(pricing.quoteExpiresAt) - quoteNow) / 1000))
    : null;
  const quoteExpired = quoteSecondsRemaining === 0;

  function refreshQuote() {
    setQuoteRefreshNonce((current) => current + 1);
    setQuoteError("");
    setReviewMode(false);
    setConfirmed(false);
    setError("");
  }

  function applyCoupon() {
    const normalizedCode = normalizeCheckoutCouponCode(couponInput);

    setCouponInput(normalizedCode);
    setCouponCode(normalizedCode);
    setQuoteError("");
    setReviewMode(false);
    setConfirmed(false);
    setError("");
  }

  function removeCoupon() {
    setCouponInput("");
    setCouponCode("");
    setQuoteError("");
    setReviewMode(false);
    setConfirmed(false);
    setError("");
  }

  function renderPaymentMethodOptions(className: string, ariaLabel: string) {
    return (
      <div className={className} role="radiogroup" aria-label={ariaLabel}>
        {enabledPaymentOptions.length ? enabledPaymentOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={paymentMethod === option.value}
            className={`vh-chain-option vh-chain-option--${option.network} ${paymentMethod === option.value ? "vh-chain-option--active" : ""}`}
            data-token={option.label}
            onClick={() => handlePaymentMethodSelect(option.value)}
          >
            <span className="vh-chain-option__asset-row">
              <span className="vh-chain-option__icon-stack" aria-hidden="true">
                <span className={`vh-chain-option__coin vh-chain-option__coin--${option.network === "ethereum" ? "eth" : "sol"}`} />
                {option.kind === "token" ? <span className={`vh-chain-option__coin vh-chain-option__coin--${option.label.toLowerCase()}`} /> : null}
              </span>
              <span className="vh-chain-option__pair">{getCheckoutPaymentPairLabel(option)}</span>
            </span>
            <span className="vh-chain-option__name">{option.network === "ethereum" ? "Ethereum" : "Solana"}</span>
            <span className="vh-chain-option__wallet">{option.walletProvider === "metamask" ? "MetaMask" : "Phantom Wallet"}</span>
            <span className="vh-chain-option__detail">
              {option.network === "ethereum" ? "Ethereum Mainnet" : "Solana Mainnet"} · {option.tokenStandard.toUpperCase()}
            </span>
          </button>
        )) : (
          <p className="vh-payment-note">Crypto payment methods are currently unavailable.</p>
        )}
      </div>
    );
  }

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
      setError(
        !paymentMethod
          ? "Choose Ethereum or Solana before reviewing this order."
          : quoteError || `The live ${getPaymentMethodLabel(paymentMethod)} quote is still loading.`,
      );
      return;
    }

    if (paymentMethod && !isPaymentMethodEnabled(checkoutSettings, paymentMethod)) {
      setError("This payment method is currently unavailable. Choose another active payment method.");
      return;
    }

    if (quoteError) {
      setError(quoteError);
      return;
    }

    if (!pricing.isShippingResolved || !pricing.shippingMethodCode) {
      setError(pricing.shippingMessage || "Shipping will be calculated after completing your address.");
      return;
    }

    if (quoteExpired) {
      setError("This crypto quote has expired. Refresh the quote before continuing to wallet payment.");
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

    if (quoteError) {
      setError(quoteError);
      setReviewMode(false);
      setConfirmed(false);
      return;
    }

    if (!paymentMethod) {
      setError("Choose Ethereum or Solana before starting payment.");
      return;
    }

    if (!isPaymentMethodEnabled(checkoutSettings, paymentMethod)) {
      setError("This payment method is currently unavailable. Choose another active payment method.");
      setReviewMode(false);
      setConfirmed(false);
      return;
    }

    if (quoteExpired) {
      setError("This crypto quote has expired. Refresh the quote before opening your wallet.");
      setReviewMode(false);
      setConfirmed(false);
      return;
    }

    setLoading(true);
    setError("");
    setSubmission(null);

    try {
      const paymentConfig = getPaymentMethodConfig(paymentMethod);

      if (!paymentConfig) {
        throw new Error("Unsupported token for this chain.");
      }

      const evmPreparedWallet =
        paymentConfig.network === "ethereum"
          ? await validateWalletCanPay({
              amount: resolvedInput.payableCryptoAmount,
              paymentMethod,
            })
          : null;
      const solanaPreparedWallet =
        paymentConfig.network === "solana"
          ? await validateSolanaWalletCanPay({
              amount: resolvedInput.payableCryptoAmount,
              paymentMethod,
            })
          : null;
      const preparedWalletAddress = evmPreparedWallet?.walletAddress || solanaPreparedWallet?.walletAddress || "";

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
          deliveryLatitude: selectedDeliveryLocation?.lat ?? null,
          deliveryLongitude: selectedDeliveryLocation?.lng ?? null,
          deliveryPlaceId: selectedDeliveryLocation?.placeId || null,
          deliveryMapProvider: selectedDeliveryLocation?.provider || null,
          deliveryAddressComponents: selectedDeliveryLocation?.components || null,
          enteredAmount,
          amountMode,
          paymentMethod,
          couponCode: couponCode || null,
          attribution: readMarketingAttribution(),
          payerWalletAddress: preparedWalletAddress,
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
          couponCode?: string | null;
          couponLabel?: string | null;
          discountPhpLabel?: string | null;
          taxLabel?: string | null;
          taxPhpLabel?: string | null;
          shippingMethodCode: ShippingMethodCode | null;
          shippingMethodLabel: string | null;
          shippingZoneLabel: string | null;
          totalPhpLabel: string;
          requiredEthLabel: string;
          payableEthAmount: string;
          payableEthLabel: string;
          payableCryptoAmount?: string;
          payableCryptoLabel?: string;
          cryptoSymbol?: string;
          estimatedUsdLabel?: string;
          baseCryptoLabel?: string;
          slippageBufferLabel?: string;
          slippageBufferAmountLabel?: string;
          networkFeeEstimateLabel?: string;
          estimatedTotalLabel?: string;
          quoteExpiresAt?: string;
        };
        recipientWalletAddress?: string | null;
      }>(createOrderResponse);

      if (!createOrderResponse.ok || !createOrderPayload?.order || !createOrderPayload.payment || !createOrderPayload.pricing) {
        setError(getResponseErrorMessage(createOrderPayload, "Unable to create the order."));
        return;
      }

      if (createOrderPayload.pricing.quoteExpiresAt && Date.parse(createOrderPayload.pricing.quoteExpiresAt) <= Date.now()) {
        await rollbackPendingOrder(createOrderPayload.order.id);
        setReviewMode(false);
        setConfirmed(false);
        setError("This crypto quote expired before wallet payment started. Refresh the quote and try again.");
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
        walletAddress: createOrderPayload.payment.wallet_address || preparedWalletAddress,
        itemCount: pricing.itemCount,
        totalQuantity: pricing.totalQuantity,
        itemLines,
        subtotalPhpLabel: createOrderPayload.pricing.subtotalPhpLabel,
        shippingFeeLabel: createOrderPayload.pricing.shippingFeeLabel,
        couponCode: createOrderPayload.pricing.couponCode || null,
        couponLabel: createOrderPayload.pricing.couponLabel || null,
        discountPhpLabel: createOrderPayload.pricing.discountPhpLabel || null,
        taxLabel: createOrderPayload.pricing.taxLabel || null,
        taxPhpLabel: createOrderPayload.pricing.taxPhpLabel || null,
        shippingMethodLabel: createOrderPayload.pricing.shippingMethodLabel,
        shippingZoneLabel: createOrderPayload.pricing.shippingZoneLabel,
        totalPhpLabel: createOrderPayload.pricing.totalPhpLabel,
        requiredEthLabel: createOrderPayload.pricing.requiredEthLabel,
        payableEthLabel: createOrderPayload.pricing.payableCryptoLabel || createOrderPayload.pricing.payableEthLabel,
        cryptoSymbol: createOrderPayload.pricing.cryptoSymbol || getPaymentMethodLabel(paymentMethod),
        estimatedUsdLabel: createOrderPayload.pricing.estimatedUsdLabel || pricing.estimatedUsdLabel || null,
        baseCryptoLabel: createOrderPayload.pricing.baseCryptoLabel || pricing.baseCryptoLabel || null,
        slippageBufferLabel: createOrderPayload.pricing.slippageBufferLabel || pricing.slippageBufferLabel || null,
        slippageBufferAmountLabel: createOrderPayload.pricing.slippageBufferAmountLabel || pricing.slippageBufferAmountLabel || null,
        networkFeeEstimateLabel: createOrderPayload.pricing.networkFeeEstimateLabel || pricing.networkFeeEstimateLabel || null,
        estimatedTotalLabel: createOrderPayload.pricing.estimatedTotalLabel || pricing.estimatedTotalLabel || null,
        quoteExpiresAt: createOrderPayload.pricing.quoteExpiresAt || pricing.quoteExpiresAt || null,
        recipientWalletAddress: createOrderPayload.payment.recipient_address || createOrderPayload.recipientWalletAddress || null,
        confirmationEmailStatus: createOrderPayload.order.confirmation_email_status,
      };

      let walletPaymentSubmitted = false;
      let submittedPaymentSnapshot: SubmissionState | null = null;

      try {
        if (orderSnapshot.quoteExpiresAt && Date.parse(orderSnapshot.quoteExpiresAt) <= Date.now()) {
          throw new Error("This crypto quote expired before wallet confirmation. Refresh the quote and try again.");
        }

        const walletPayment = paymentConfig.network === "solana"
          ? await sendSolanaPayment({
              amount: createOrderPayload.pricing.payableCryptoAmount || createOrderPayload.pricing.payableEthAmount,
              paymentMethod,
              recipientAddress: orderSnapshot.recipientWalletAddress,
              expectedWalletAddress: orderSnapshot.walletAddress,
            })
          : await sendCryptoPayment({
              amount: createOrderPayload.pricing.payableCryptoAmount || createOrderPayload.pricing.payableEthAmount,
              paymentMethod,
              preparedWallet: evmPreparedWallet ?? undefined,
              recipientAddress: orderSnapshot.recipientWalletAddress,
              expectedWalletAddress: orderSnapshot.walletAddress,
            });
        walletPaymentSubmitted = true;
        submittedPaymentSnapshot = {
          ...orderSnapshot,
          txHash: walletPayment.txHash,
          walletAddress: walletPayment.walletAddress,
          verificationStatus: "pending",
          message: `Transaction submitted. Waiting for ${getPaymentMethodNetworkName(paymentMethod)} confirmation.`,
        };

        writePendingCheckoutPayment(submittedPaymentSnapshot);

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
            ...submittedPaymentSnapshot,
            verificationStatus: "pending",
            message: verifyPayload?.message || `Transaction submitted. Waiting for ${getPaymentMethodNetworkName(paymentMethod)} confirmation.`,
          });
          resetForm();
          return;
        }

        if (!verifyResponse.ok) {
          const invalidVerification = verifyPayload?.verificationStatus === "invalid";

          setSubmission({
            ...submittedPaymentSnapshot,
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
          ...submittedPaymentSnapshot,
          verificationStatus: "paid",
          message: verifyPayload?.message || `${getPaymentMethodNetworkName(paymentMethod)} payment confirmed.`,
        });
        clearPendingCheckoutPayment();
        writeBagItems([]);
        resetForm();
      } catch (walletError) {
        if (walletPaymentSubmitted) {
          if (submittedPaymentSnapshot) {
            writePendingCheckoutPayment(submittedPaymentSnapshot);
            setSubmission({
              ...submittedPaymentSnapshot,
              verificationStatus: "pending",
              message:
                "Transaction submitted. Verification could not complete locally. The order remains pending and can be rechecked from the dashboard.",
            });
          }

          setError(
            `${getErrorMessage(walletError, "The on-chain payment could not be verified locally.")} The order remains pending and can be rechecked from the dashboard.`,
          );
          return;
        }

        let rollbackMessage = "";

        try {
          await rollbackPendingOrder(orderSnapshot.orderId);
        } catch (rollbackError) {
          rollbackMessage = ` ${getErrorMessage(rollbackError, "The temporary order could not be rolled back automatically.")}`;
        }

        setError(
          `${getWeb3ErrorMessage(walletError, `${getPaymentMethodLabel(paymentMethod)} payment was not completed.`)} Your bag was kept so you can try again.${rollbackMessage}`,
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
                <AddressAutocomplete
                  value={address1}
                  onValueChange={setAddress1}
                  onSelect={applyCheckoutSuggestion}
                  context={{ city, province, postalCode, country }}
                  placeholder="Search building, street, or area"
                />
                <p className="vh-payment-note">
                  Search to auto-fill your address, then add your house/unit number. City, province, and postal code fill in
                  automatically.
                </p>
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
                <div className="vh-checkout-map-card">
                  <div className="vh-checkout-map-card__header">
                    <p className="vh-field__label">Delivery Location</p>
                    <span>{checkoutMapHeaderCopy}</span>
                  </div>
                  <div className="vh-address-search-row vh-address-search-row--gps-only">
                    <button
                      type="button"
                      className="vh-address-gps-button"
                      onClick={useCheckoutCurrentLocation}
                      disabled={geolocating}
                    >
                      <Crosshair size={15} strokeWidth={1.9} aria-hidden="true" />
                      {geolocating ? "Locating..." : "Use current location"}
                    </button>
                  </div>
                  <VhInteractiveMap
                    ariaLabel="Checkout shipping address map"
                    className="vh-checkout-map"
                    markers={[]}
                    markerStyle="pin"
                    emptyTitle={checkoutMapEmptyTitle}
                    emptyCopy={checkoutMapEmptyCopy}
                    onLocationMarked={markCheckoutLocation}
                    centerPinMode
                    pinLocation={
                      checkoutResolvedLocation
                        ? { lat: checkoutResolvedLocation.lat, lng: checkoutResolvedLocation.lng }
                        : null
                    }
                    onCenterCommit={markCheckoutLocation}
                    recenterTo={mapJumpTarget}
                    zoom={15}
                  />
                  <p className="vh-checkout-map-hint">
                    Search your address or tap “Use current location,” then drag the map so the pin sits exactly on your door.
                  </p>
                </div>
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
                {renderPaymentMethodOptions("vh-chain-selector vh-chain-selector--desktop", "Payment network")}
                {renderPaymentMethodOptions("vh-chain-selector vh-chain-selector--mobile", "Mobile payment network")}
                <p className="vh-payment-note">
                  {paymentMethod
                    ? `${getPaymentMethodNetworkName(paymentMethod)} selected.`
                    : "Choose a chain and token to load the live quote and continue to payment."}
                </p>
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
                    {paymentMethod ? getPaymentMethodLabel(paymentMethod) : "Crypto"}
                  </button>
                </div>
              </div>

              <div className="vh-field">
                <label htmlFor="checkout-entered-amount">
                  {amountMode === "php"
                    ? "Entered Payment Amount (PHP)"
                    : `Entered Payment Amount (${paymentMethod ? getPaymentMethodLabel(paymentMethod) : "Crypto"})`}
                </label>
                <input
                  id="checkout-entered-amount"
                  name="enteredAmount"
                  type="number"
                  min={amountMode === "php" ? "1" : "0.0000001"}
                  step={amountMode === "php" ? "0.01" : "0.0000001"}
                  className="vh-input"
                  placeholder={amountMode === "php" ? pricing?.totalPhp || "12500.00" : pricing?.requiredCryptoAmount || pricing?.requiredEth || "0.010000"}
                  value={enteredAmount}
                  onChange={(event) => setEnteredAmount(event.target.value)}
                  required
                />
              </div>

              <div className="vh-field vh-checkout-coupon">
                <label htmlFor="checkout-coupon-code">Coupon Code</label>
                <div className="vh-checkout-coupon__row">
                  <input
                    id="checkout-coupon-code"
                    type="text"
                    className="vh-input"
                    placeholder="Enter code"
                    value={couponInput}
                    onChange={(event) => setCouponInput(normalizeCheckoutCouponCode(event.target.value))}
                  />
                  <button className="vh-button vh-button--secondary" type="button" onClick={applyCoupon} disabled={!couponInput.trim() || quoteLoading}>
                    Apply
                  </button>
                  {couponCode ? (
                    <button className="vh-button vh-button--ghost" type="button" onClick={removeCoupon} disabled={quoteLoading}>
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="vh-payment-note">
                  {pricing?.couponMessage || (couponCode ? "Checking coupon eligibility with the live quote." : "Discounts are validated securely at checkout.")}
                </p>
              </div>

              <div className="vh-checkout-pricing-panel vh-pricing-panel" aria-live="polite" aria-busy={quoteLoading}>
                <div className="vh-checkout-pricing-panel__header">
                  <p className="vh-field__label">Live Quote</p>
                  <span>{quoteLoading ? "Refreshing" : pricing ? "Locked briefly" : paymentMethod ? "Loading" : "Select payment"}</span>
                </div>

                {pricing ? (
                  <>
                    <div className="vh-pricing-panel__row">
                      <span>Order Total</span>
                      <strong>{pricing.totalPhpLabel}</strong>
                    </div>
                    <div className="vh-pricing-panel__row vh-pricing-panel__row--total">
                      <span>You Pay</span>
                      <strong>{toFriendlyCrypto(pricing.estimatedTotalLabel)}</strong>
                    </div>
                    <div className="vh-pricing-panel__row">
                      <span>Quote Expires</span>
                      <strong>{formatQuoteCountdown(quoteSecondsRemaining)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="vh-pricing-panel__row">
                      <span>Order Total</span>
                      <strong>{totalLabel}</strong>
                    </div>
                    <p className="vh-checkout-quote-note vh-payment-note">
                      {paymentMethod ? "Loading the live crypto quote." : "Choose a payment method to load the live quote."}
                    </p>
                  </>
                )}

                {quoteError ? <p className="vh-checkout-quote-note vh-payment-note vh-payment-note--error">{quoteError}</p> : null}
                <p className="vh-checkout-quote-note vh-payment-note">Full breakdown is in your order summary · the exact amount is confirmed in your wallet.</p>
                {pricing ? (
                  <button type="button" className="vh-quote-refresh" disabled={quoteLoading} onClick={refreshQuote}>
                    {quoteLoading ? "Refreshing Quote..." : quoteExpired ? "Refresh Expired Quote" : "Refresh Quote"}
                  </button>
                ) : null}
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
                  {pricing.discountPhpCents > 0 ? (
                    <>
                      Coupon: {pricing.couponCode} · -{pricing.discountPhpLabel}
                      <br />
                    </>
                  ) : null}
                  {pricing.taxLabel ? (
                    <>
                      Tax: {pricing.taxLabel} · {pricing.taxPhpLabel}
                      <br />
                    </>
                  ) : null}
                  Order Total: {pricing.totalPhpLabel}
                  <br />
                  Estimated USD value: {pricing.estimatedUsdLabel}
                  <br />
                  Crypto equivalent: {pricing.baseCryptoLabel}
                  <br />
                  Market buffer: {pricing.slippageBufferAmountLabel} ({pricing.slippageBufferLabel})
                  <br />
                  Network fee estimate: {pricing.networkFeeEstimateLabel}
                  <br />
                  Estimated total: {pricing.estimatedTotalLabel}
                  <br />
                  Quote expires in: {formatQuoteCountdown(quoteSecondsRemaining)}
                  <br />
                  Required: {pricing.requiredEthLabel}
                  <br />
                  Entered amount: {resolvedInput.enteredAmountLabel}
                  <br />
                  You will send: {resolvedInput.payableCryptoAmount} {pricing.cryptoSymbol || (paymentMethod ? getPaymentMethodLabel(paymentMethod) : "Crypto")}
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
                  <br />
                  Final network fee may vary slightly at wallet confirmation.
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
                  <span>I confirm these order details are correct before opening the payment in my wallet.</span>
                </label>
              ) : null}

              {quoteError ? <div className="vh-status vh-status--error">{quoteError}</div> : null}
              {error ? <div className="vh-status vh-status--error">{error}</div> : null}

              <div className="vh-checkout-action-row">
                {!reviewMode ? (
                  <button
                    type="button"
                    className="action-button action-button--black action-button--lg"
                    disabled={loading || quoteLoading || !paymentMethod || !pricing || quoteExpired || Boolean(quoteError)}
                    onClick={handleReview}
                  >
                    {quoteExpired ? "Refresh Quote To Continue" : paymentMethod ? "Continue To Review" : "Choose Payment To Continue"}
                  </button>
                ) : (
                  <>
                    <button type="submit" className="action-button action-button--black action-button--lg" disabled={loading || !pricing || !resolvedInput?.ok || quoteExpired || Boolean(quoteError)}>
                      {loading
                        ? "Processing..."
                        : quoteExpired
                          ? "Refresh Quote To Pay"
                        : getPaymentMethodConfig(paymentMethod)?.network === "solana"
                          ? "Pay With Phantom Wallet"
                          : "Pay With MetaMask"}
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
                  ? `${getPaymentMethodNetworkName(submission.paymentMethod)} payment confirmed.`
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
                {submission.discountPhpLabel ? (
                  <>
                    Coupon: {submission.couponCode || submission.couponLabel || "Applied"} · -{submission.discountPhpLabel}
                    <br />
                  </>
                ) : null}
                {submission.taxLabel ? (
                  <>
                    Tax: {submission.taxLabel} · {submission.taxPhpLabel}
                    <br />
                  </>
                ) : null}
                Total: {submission.totalPhpLabel}
                <br />
                Estimated USD: {submission.estimatedUsdLabel || "--"}
                <br />
                Required {submission.cryptoSymbol}: {submission.requiredEthLabel}
                <br />
                Market buffer: {submission.slippageBufferAmountLabel || "--"}
                {submission.slippageBufferLabel ? ` (${submission.slippageBufferLabel})` : ""}
                <br />
                Network fee estimate: {submission.networkFeeEstimateLabel || "--"}
                <br />
                Estimated total: {submission.estimatedTotalLabel || "--"}
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
            {(submission?.discountPhpLabel || (pricing?.discountPhpCents ?? 0) > 0) ? (
              <div className="storefront-app-summary-row">
                <span>Coupon{(submission?.couponCode || pricing?.couponCode) ? ` (${submission?.couponCode || pricing?.couponCode})` : ""}</span>
                <strong>-{submission?.discountPhpLabel ?? pricing?.discountPhpLabel}</strong>
              </div>
            ) : null}
            {(submission?.taxLabel || pricing?.taxLabel) ? (
              <div className="storefront-app-summary-row">
                <span>Tax ({submission?.taxLabel ?? pricing?.taxLabel})</span>
                <strong>{submission?.taxPhpLabel ?? pricing?.taxPhpLabel}</strong>
              </div>
            ) : null}
            <div className="storefront-app-summary-row">
              <span>Total</span>
              <strong>{submission?.totalPhpLabel ?? totalLabel}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Estimated USD</span>
              <strong>{submission?.estimatedUsdLabel ?? pricing?.estimatedUsdLabel ?? "--"}</strong>
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
              <strong>{submission?.cryptoSymbol ?? (paymentMethod ? getPaymentMethodLabel(paymentMethod) : "Choose network")}</strong>
            </div>
            <div className="storefront-app-summary-row storefront-app-summary-row--em">
              <span>You Pay</span>
              <strong>{toFriendlyCrypto(submission?.estimatedTotalLabel ?? pricing?.estimatedTotalLabel)}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Rate</span>
              <strong>{pricing?.phpPerCryptoLabel || pricing?.phpPerEthLabel || "--"}</strong>
            </div>
            <div className="storefront-app-summary-row">
              <span>Quote Expires</span>
              <strong>{submission?.quoteExpiresAt ? formatQuoteTime(submission.quoteExpiresAt) : formatQuoteCountdown(quoteSecondsRemaining)}</strong>
            </div>

            {(submission || pricing) ? (
              <>
                <button
                  type="button"
                  className="vh-summary-breakdown-toggle"
                  aria-expanded={showFeeBreakdown}
                  onClick={() => setShowFeeBreakdown((open) => !open)}
                >
                  {showFeeBreakdown ? "Hide fee breakdown" : "View fee breakdown"}
                </button>
                {showFeeBreakdown ? (
                  <div className="vh-summary-breakdown">
                    <div className="storefront-app-summary-row">
                      <span>Amount in {submission?.cryptoSymbol ?? (paymentMethod ? getPaymentMethodLabel(paymentMethod) : "crypto")}</span>
                      <strong>{submission?.baseCryptoLabel ?? pricing?.baseCryptoLabel ?? "--"}</strong>
                    </div>
                    <div className="storefront-app-summary-row">
                      <span>Exact amount required</span>
                      <strong>{submission?.requiredEthLabel ?? pricing?.requiredCryptoLabel ?? pricing?.requiredEthLabel ?? "--"}</strong>
                    </div>
                    <div className="storefront-app-summary-row">
                      <span>Network fee</span>
                      <strong>{submission?.networkFeeEstimateLabel ?? pricing?.networkFeeEstimateLabel ?? "--"}</strong>
                    </div>
                    <div className="storefront-app-summary-row">
                      <span>Price protection</span>
                      <strong>
                        {submission?.slippageBufferAmountLabel ?? pricing?.slippageBufferAmountLabel ?? "--"}
                        {submission?.slippageBufferLabel || pricing?.slippageBufferLabel
                          ? ` (${submission?.slippageBufferLabel ?? pricing?.slippageBufferLabel})`
                          : ""}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {!submission && pricing ? (
              <button type="button" className="vh-quote-refresh" disabled={quoteLoading} onClick={refreshQuote}>
                {quoteLoading ? "Refreshing Quote..." : quoteExpired ? "Refresh Expired Quote" : "Refresh Quote"}
              </button>
            ) : null}
            <p className="vh-payment-note">{CRYPTO_NETWORK_FEE_NOTE}</p>
            <p className="vh-payment-note">
              {shippingMessage || pricing?.shippingMessage || localShippingPreview.message}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
