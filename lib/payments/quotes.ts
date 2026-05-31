import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getCatalogSubtotalPhpCents, getProductAvailableSizes, type CatalogProduct } from "@/lib/catalog";
import { DEFAULT_GENERAL_SETTINGS, loadFreshAdminGeneralSettings, type AdminGeneralSettings } from "@/lib/admin/settings";
import {
  isPaymentMethodEnabled,
} from "@/lib/checkout-availability";
import { validateCouponForCheckout, type CouponApplication } from "@/lib/coupons";
import { getErrorMessage } from "@/lib/http";
import { loadPublishedCatalogProduct } from "@/lib/products";
import {
  addCryptoAmountBuffer,
  convertPhpCentsToEthAmount,
  convertPhpCentsToCryptoAmount,
  formatPhpCurrency,
  formatPhpCurrencyFromCents,
  normalizePaymentAmount,
  phpCentsToDecimalString,
} from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodLabel, type PaymentMethod } from "@/lib/payments/options";
import { getCheckoutShippingQuote, type ShippingAddressInput, type ShippingMethodCode } from "@/lib/shipping";
import { getActiveTaxRule, type ActiveTaxRule } from "@/lib/tax";

const COINGECKO_SIMPLE_PRICE_ENDPOINT =
  process.env.COINGECKO_SIMPLE_PRICE_ENDPOINT?.trim() || "https://api.coingecko.com/api/v3/simple/price";
const BINANCE_TICKER_PRICE_ENDPOINT =
  process.env.BINANCE_TICKER_PRICE_ENDPOINT?.trim() || "https://api.binance.com/api/v3/ticker/price";
const COINBASE_EXCHANGE_RATES_ENDPOINT = "https://api.coinbase.com/v2/exchange-rates";
const CRYPTOCOMPARE_PRICE_ENDPOINT = "https://min-api.cryptocompare.com/data/price";

const QUOTE_CACHE_TTL_MS = 60_000;
const STALE_QUOTE_TTL_MS = 15 * 60_000;
const DEFAULT_QUOTE_TTL_SECONDS = 60;
const DEFAULT_PRICE_DIFF_TOLERANCE_PERCENT = 2;
const DEFAULT_SLIPPAGE_BUFFER_PERCENT = 1.5;
const execFileAsync = promisify(execFile);

export type EthPhpQuote = {
  phpPerEth: number;
  quoteSource: string;
  quoteUpdatedAt: string | null;
};

export type CryptoPhpQuote = {
  phpPerAsset: number;
  quoteSource: string;
  quoteUpdatedAt: string | null;
  symbol: string;
  usdPerAsset?: number | null;
  usdPhpRate?: number | null;
  binanceUsdPerAsset?: number | null;
  priceDifferencePercent?: number | null;
  priceTolerancePercent?: number | null;
};

export type CheckoutPricing = {
  product: CatalogProduct;
  quantity: number;
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  taxRuleId: ActiveTaxRule["id"] | null;
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

export type CheckoutLineItemInput = {
  productId: string;
  selectedSize: string;
  quantity: number;
};

export type CheckoutBagPricingItem = {
  product: CatalogProduct;
  selectedSize: string;
  quantity: number;
  lineTotalPhpCents: number;
  lineTotalPhp: string;
  lineTotalPhpLabel: string;
};

export type CheckoutBagPricing = {
  items: CheckoutBagPricingItem[];
  itemCount: number;
  totalQuantity: number;
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  shippingFeePhpCents: number | null;
  shippingFeePhp: string | null;
  shippingFeeLabel: string;
  shippingOptions: Array<{
    code: ShippingMethodCode;
    label: string;
    feePhpCents: number;
    feePhp: string;
    feeLabel: string;
    description: string;
  }>;
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
  taxRuleId: ActiveTaxRule["id"] | null;
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

type CachedEthPhpQuote = EthPhpQuote & {
  fetchedAt: number;
};

let cachedEthPhpQuote: CachedEthPhpQuote | null = null;
let inFlightEthPhpQuotePromise: Promise<EthPhpQuote> | null = null;
let cachedSolPhpQuote: (CryptoPhpQuote & { fetchedAt: number }) | null = null;
let inFlightSolPhpQuotePromise: Promise<CryptoPhpQuote> | null = null;
let cachedUsdPhpQuote: (CryptoPhpQuote & { fetchedAt: number }) | null = null;
let inFlightUsdPhpQuotePromise: Promise<CryptoPhpQuote> | null = null;
const cachedPaymentPhpQuotes = new Map<string, CryptoPhpQuote & { fetchedAt: number }>();
const inFlightPaymentPhpQuotePromises = new Map<string, Promise<CryptoPhpQuote>>();

function getCachedEthPhpQuote(maxAgeMs: number): EthPhpQuote | null {
  if (!cachedEthPhpQuote) {
    return null;
  }

  if (Date.now() - cachedEthPhpQuote.fetchedAt > maxAgeMs) {
    return null;
  }

  return {
    phpPerEth: cachedEthPhpQuote.phpPerEth,
    quoteSource: cachedEthPhpQuote.quoteSource,
    quoteUpdatedAt: cachedEthPhpQuote.quoteUpdatedAt,
  };
}

function cacheEthPhpQuote(quote: EthPhpQuote) {
  cachedEthPhpQuote = {
    ...quote,
    fetchedAt: Date.now(),
  };

  return quote;
}

function toStaleEthPhpQuote(quote: EthPhpQuote): EthPhpQuote {
  return {
    ...quote,
    quoteSource: `${quote.quoteSource} (cached)`,
  };
}

function parseNumericQuote(value: number | string | undefined, errorMessage: string) {
  const numericValue = typeof value === "string" ? Number(value) : value;

  if (!numericValue || !Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(errorMessage);
  }

  return numericValue;
}

function parsePositiveEnvNumber(value: string | undefined, fallback: number) {
  const parsedValue = Number(value?.trim());

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function getQuoteTtlSeconds() {
  return Math.max(15, Math.min(300, Math.round(parsePositiveEnvNumber(process.env.CRYPTO_QUOTE_TTL_SECONDS, DEFAULT_QUOTE_TTL_SECONDS))));
}

function getPriceDifferenceTolerancePercent() {
  return Math.max(
    0.1,
    Math.min(10, parsePositiveEnvNumber(process.env.CRYPTO_PRICE_DIFF_TOLERANCE_PERCENT, DEFAULT_PRICE_DIFF_TOLERANCE_PERCENT)),
  );
}

function getSlippageBufferPercent() {
  return Math.max(0, Math.min(5, parsePositiveEnvNumber(process.env.CRYPTO_SLIPPAGE_BUFFER_PERCENT, DEFAULT_SLIPPAGE_BUFFER_PERCENT)));
}

function formatUsdCurrency(amount: string | number) {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

function formatCryptoAmountLabel(amount: string | number, symbol: string) {
  return `${normalizePaymentAmount(amount)} ${symbol}`;
}

function getCoinGeckoAssetId(paymentMethod: PaymentMethod | string) {
  const config = getPaymentMethodConfig(paymentMethod);

  switch (config?.tokenType) {
    case "ETH":
      return "ethereum";
    case "SOL":
      return "solana";
    case "USDC":
      return "usd-coin";
    case "USDT":
      return "tether";
    default:
      return "ethereum";
  }
}

function getBinanceSymbol(paymentMethod: PaymentMethod | string) {
  const config = getPaymentMethodConfig(paymentMethod);

  switch (config?.tokenType) {
    case "ETH":
      return "ETHUSDT";
    case "SOL":
      return "SOLUSDT";
    case "USDC":
      return "USDCUSDT";
    case "USDT":
      return null;
    default:
      return "ETHUSDT";
  }
}

function getNetworkFeeEstimate(paymentMethod: PaymentMethod | string) {
  const config = getPaymentMethodConfig(paymentMethod);

  if (config?.network === "solana") {
    return {
      amount: config.kind === "token" ? "0.000015" : "0.00001",
      symbol: "SOL",
    };
  }

  return {
    amount: config?.kind === "token" ? "0.004" : "0.002",
    symbol: "ETH",
  };
}

function buildEstimatedTotalLabel(requiredCryptoAmount: string, cryptoSymbol: string, networkFee: { amount: string; symbol: string }, decimals: number) {
  if (networkFee.symbol === cryptoSymbol) {
    const total = addCryptoAmountBuffer(requiredCryptoAmount, 0, decimals);
    const fee = addCryptoAmountBuffer(networkFee.amount, 0, decimals);
    const totalUnits = Number(total.totalAmount) + Number(fee.totalAmount);

    if (Number.isFinite(totalUnits)) {
      return formatCryptoAmountLabel(totalUnits.toFixed(decimals), cryptoSymbol);
    }
  }

  return `${formatCryptoAmountLabel(requiredCryptoAmount, cryptoSymbol)} + ${formatCryptoAmountLabel(networkFee.amount, networkFee.symbol)} fee`;
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string" && code.trim()) {
      return code;
    }
  }

  if (typeof error === "object" && error && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;

    if (typeof cause === "object" && cause && "code" in cause) {
      const causeCode = (cause as { code?: unknown }).code;

      if (typeof causeCode === "string" && causeCode.trim()) {
        return causeCode;
      }
    }
  }

  return "";
}

function isRetryableTransportError(error: unknown) {
  const message = getErrorMessage(error, "");
  const code = getErrorCode(error);

  return (
    message === "fetch failed" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EPERM"
  );
}

async function parseJsonResponse<T>(responseText: string, errorMessage: string) {
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(errorMessage);
  }
}

async function fetchJsonViaCurl<T>(url: string, headers: Record<string, string>, errorMessage: string) {
  const args = ["-fsSL", "--connect-timeout", "10", "--max-time", "15"];

  for (const [headerName, headerValue] of Object.entries(headers)) {
    args.push("-H", `${headerName}: ${headerValue}`);
  }

  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args, {
      maxBuffer: 1024 * 1024,
    });

    return await parseJsonResponse<T>(stdout, errorMessage);
  } catch (error) {
    throw new Error(getErrorMessage(error, errorMessage));
  }
}

async function fetchJsonWithTransportFallback<T>(url: string, headers: Record<string, string>, errorMessage: string) {
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (!isRetryableTransportError(error)) {
      throw error;
    }

    logPaymentDebug("quote-fetch-curl-fallback", {
      error: getErrorMessage(error, errorMessage),
      url,
    });

    return fetchJsonViaCurl<T>(url, headers, errorMessage);
  }
}

async function fetchCoingeckoQuote(): Promise<EthPhpQuote> {
  const endpoint = new URL(COINGECKO_SIMPLE_PRICE_ENDPOINT);
  endpoint.searchParams.set("ids", "ethereum");
  endpoint.searchParams.set("vs_currencies", "php");
  endpoint.searchParams.set("include_last_updated_at", "true");
  endpoint.searchParams.set("precision", "full");

  const headers: HeadersInit = {
    accept: "application/json",
  };

  const demoKey = process.env.COINGECKO_DEMO_API_KEY?.trim();

  if (demoKey) {
    headers["x-cg-demo-api-key"] = demoKey;
  }

  const payload = await fetchJsonWithTransportFallback<{
    ethereum?: {
      php?: number;
      last_updated_at?: number;
    };
  }>(endpoint.toString(), headers, "Unable to fetch the current ETH/PHP conversion rate.");

  const phpPerEth = parseNumericQuote(payload.ethereum?.php, "ETH/PHP conversion data is unavailable right now.");

  return {
    phpPerEth,
    quoteSource: "coingecko",
    quoteUpdatedAt: payload.ethereum?.last_updated_at
      ? new Date(payload.ethereum.last_updated_at * 1000).toISOString()
      : null,
  };
}

async function fetchCoingeckoSolQuote(): Promise<CryptoPhpQuote> {
  const endpoint = new URL(COINGECKO_SIMPLE_PRICE_ENDPOINT);
  endpoint.searchParams.set("ids", "solana");
  endpoint.searchParams.set("vs_currencies", "php");
  endpoint.searchParams.set("include_last_updated_at", "true");
  endpoint.searchParams.set("precision", "full");

  const headers: HeadersInit = {
    accept: "application/json",
  };

  const demoKey = process.env.COINGECKO_DEMO_API_KEY?.trim();

  if (demoKey) {
    headers["x-cg-demo-api-key"] = demoKey;
  }

  const payload = await fetchJsonWithTransportFallback<{
    solana?: {
      php?: number;
      last_updated_at?: number;
    };
  }>(endpoint.toString(), headers, "Unable to fetch the current SOL/PHP conversion rate.");

  return {
    phpPerAsset: parseNumericQuote(payload.solana?.php, "SOL/PHP conversion data is unavailable right now."),
    quoteSource: "coingecko",
    quoteUpdatedAt: payload.solana?.last_updated_at ? new Date(payload.solana.last_updated_at * 1000).toISOString() : null,
    symbol: "SOL",
  };
}

async function fetchCoingeckoPaymentQuote(paymentMethod: PaymentMethod | string): Promise<CryptoPhpQuote> {
  const config = getPaymentMethodConfig(paymentMethod);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  const assetId = getCoinGeckoAssetId(paymentMethod);
  const endpoint = new URL(COINGECKO_SIMPLE_PRICE_ENDPOINT);
  endpoint.searchParams.set("ids", assetId);
  endpoint.searchParams.set("vs_currencies", "php,usd");
  endpoint.searchParams.set("include_last_updated_at", "true");
  endpoint.searchParams.set("precision", "full");

  const headers: HeadersInit = {
    accept: "application/json",
  };
  const demoKey = process.env.COINGECKO_DEMO_API_KEY?.trim();

  if (demoKey) {
    headers["x-cg-demo-api-key"] = demoKey;
  }

  const payload = await fetchJsonWithTransportFallback<Record<string, { php?: number; usd?: number; last_updated_at?: number }>>(
    endpoint.toString(),
    headers,
    `Unable to fetch the current ${config.label}/PHP conversion rate.`,
  );
  const assetQuote = payload[assetId];
  const phpPerAsset = parseNumericQuote(assetQuote?.php, `${config.label}/PHP conversion data is unavailable right now.`);
  const usdPerAsset = parseNumericQuote(assetQuote?.usd, `${config.label}/USD conversion data is unavailable right now.`);

  return {
    phpPerAsset,
    usdPerAsset,
    usdPhpRate: phpPerAsset / usdPerAsset,
    quoteSource: "coingecko",
    quoteUpdatedAt: assetQuote?.last_updated_at ? new Date(assetQuote.last_updated_at * 1000).toISOString() : null,
    symbol: config.label,
  };
}

async function fetchBinanceUsdPrice(paymentMethod: PaymentMethod | string) {
  const config = getPaymentMethodConfig(paymentMethod);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  const symbol = getBinanceSymbol(paymentMethod);

  if (!symbol) {
    return 1;
  }

  const endpoint = new URL(BINANCE_TICKER_PRICE_ENDPOINT);
  endpoint.searchParams.set("symbol", symbol);

  const payload = await fetchJsonWithTransportFallback<{ symbol?: string; price?: string }>(
    endpoint.toString(),
    { accept: "application/json" },
    `Unable to fetch the current Binance ${symbol} market price.`,
  );

  return parseNumericQuote(payload.price, `Binance ${symbol} market price is unavailable right now.`);
}

function validateBinancePriceDifference(quote: CryptoPhpQuote, paymentMethod: PaymentMethod | string): CryptoPhpQuote {
  const config = getPaymentMethodConfig(paymentMethod);
  const coingeckoUsdPrice = quote.usdPerAsset;
  const binanceUsdPrice = quote.binanceUsdPerAsset;
  const tolerancePercent = getPriceDifferenceTolerancePercent();

  if (!coingeckoUsdPrice || !binanceUsdPrice) {
    throw new Error(`Unable to validate the current ${config?.label || "crypto"} market price. Please refresh the quote.`);
  }

  const priceDifferencePercent = (Math.abs(coingeckoUsdPrice - binanceUsdPrice) / coingeckoUsdPrice) * 100;

  if (priceDifferencePercent > tolerancePercent) {
    throw new Error(
      `Crypto market price moved too quickly for ${config?.label || "this payment"}. Refresh the quote before continuing.`,
    );
  }

  return {
    ...quote,
    priceDifferencePercent,
    priceTolerancePercent: tolerancePercent,
    quoteSource: `${quote.quoteSource}+binance_validation`,
  };
}

async function fetchCoinbaseQuote(): Promise<EthPhpQuote> {
  const endpoint = new URL(COINBASE_EXCHANGE_RATES_ENDPOINT);
  endpoint.searchParams.set("currency", "ETH");

  const payload = await fetchJsonWithTransportFallback<{
    data?: {
      rates?: {
        PHP?: string;
      };
    };
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current ETH/PHP conversion rate.");

  return {
    phpPerEth: parseNumericQuote(payload.data?.rates?.PHP, "Coinbase ETH/PHP conversion data is unavailable right now."),
    quoteSource: "coinbase",
    quoteUpdatedAt: null,
  };
}

async function fetchCryptocompareQuote(): Promise<EthPhpQuote> {
  const endpoint = new URL(CRYPTOCOMPARE_PRICE_ENDPOINT);
  endpoint.searchParams.set("fsym", "ETH");
  endpoint.searchParams.set("tsyms", "PHP");

  const payload = await fetchJsonWithTransportFallback<{
    PHP?: number;
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current ETH/PHP conversion rate.");

  return {
    phpPerEth: parseNumericQuote(payload.PHP, "CryptoCompare ETH/PHP conversion data is unavailable right now."),
    quoteSource: "cryptocompare",
    quoteUpdatedAt: null,
  };
}

async function fetchCoinbaseSolQuote(): Promise<CryptoPhpQuote> {
  const endpoint = new URL(COINBASE_EXCHANGE_RATES_ENDPOINT);
  endpoint.searchParams.set("currency", "SOL");

  const payload = await fetchJsonWithTransportFallback<{
    data?: {
      rates?: {
        PHP?: string;
      };
    };
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current SOL/PHP conversion rate.");

  return {
    phpPerAsset: parseNumericQuote(payload.data?.rates?.PHP, "Coinbase SOL/PHP conversion data is unavailable right now."),
    quoteSource: "coinbase",
    quoteUpdatedAt: null,
    symbol: "SOL",
  };
}

async function fetchCryptocompareSolQuote(): Promise<CryptoPhpQuote> {
  const endpoint = new URL(CRYPTOCOMPARE_PRICE_ENDPOINT);
  endpoint.searchParams.set("fsym", "SOL");
  endpoint.searchParams.set("tsyms", "PHP");

  const payload = await fetchJsonWithTransportFallback<{
    PHP?: number;
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current SOL/PHP conversion rate.");

  return {
    phpPerAsset: parseNumericQuote(payload.PHP, "CryptoCompare SOL/PHP conversion data is unavailable right now."),
    quoteSource: "cryptocompare",
    quoteUpdatedAt: null,
    symbol: "SOL",
  };
}

async function fetchCoinbaseUsdQuote(): Promise<CryptoPhpQuote> {
  const endpoint = new URL(COINBASE_EXCHANGE_RATES_ENDPOINT);
  endpoint.searchParams.set("currency", "USD");

  const payload = await fetchJsonWithTransportFallback<{
    data?: {
      rates?: {
        PHP?: string;
      };
    };
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current USD/PHP conversion rate.");

  return {
    phpPerAsset: parseNumericQuote(payload.data?.rates?.PHP, "Coinbase USD/PHP conversion data is unavailable right now."),
    quoteSource: "coinbase",
    quoteUpdatedAt: null,
    symbol: "USD",
  };
}

async function fetchCryptocompareUsdQuote(): Promise<CryptoPhpQuote> {
  const endpoint = new URL(CRYPTOCOMPARE_PRICE_ENDPOINT);
  endpoint.searchParams.set("fsym", "USD");
  endpoint.searchParams.set("tsyms", "PHP");

  const payload = await fetchJsonWithTransportFallback<{
    PHP?: number;
  }>(endpoint.toString(), { accept: "application/json" }, "Unable to fetch the current USD/PHP conversion rate.");

  return {
    phpPerAsset: parseNumericQuote(payload.PHP, "CryptoCompare USD/PHP conversion data is unavailable right now."),
    quoteSource: "cryptocompare",
    quoteUpdatedAt: null,
    symbol: "USD",
  };
}

async function fetchLiveEthPhpQuote(): Promise<EthPhpQuote> {
  const providers: Array<{ name: string; load: () => Promise<EthPhpQuote> }> = [
    { name: "coingecko", load: fetchCoingeckoQuote },
    { name: "coinbase", load: fetchCoinbaseQuote },
    { name: "cryptocompare", load: fetchCryptocompareQuote },
  ];
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const quote = await provider.load();

      logPaymentDebug("quote-provider-success", {
        phpPerEth: quote.phpPerEth,
        provider: provider.name,
      });

      return quote;
    } catch (error) {
      const message = getErrorMessage(error, "Unknown quote fetch error.");

      failures.push(`${provider.name}: ${message}`);

      logPaymentDebug("quote-provider-failed", {
        error: message,
        provider: provider.name,
      });
    }
  }

  throw new Error(`All live ETH/PHP quote providers failed. ${failures.join(" | ")}`);
}

export async function fetchEthPhpQuote(): Promise<EthPhpQuote> {
  const freshCachedQuote = getCachedEthPhpQuote(QUOTE_CACHE_TTL_MS);

  if (freshCachedQuote) {
    return freshCachedQuote;
  }

  if (!inFlightEthPhpQuotePromise) {
    inFlightEthPhpQuotePromise = fetchLiveEthPhpQuote()
      .then((quote) => cacheEthPhpQuote(quote))
      .finally(() => {
        inFlightEthPhpQuotePromise = null;
      });
  }

  try {
    return await inFlightEthPhpQuotePromise;
  } catch (error) {
    const staleCachedQuote = getCachedEthPhpQuote(STALE_QUOTE_TTL_MS);

    if (staleCachedQuote) {
      logPaymentDebug("quote-provider-stale-cache-fallback", {
        cachedSource: staleCachedQuote.quoteSource,
        error: getErrorMessage(error, "Unknown quote fetch error."),
      });

      return toStaleEthPhpQuote(staleCachedQuote);
    }

    throw new Error("Unable to load the current ETH/PHP quote right now. Please try again in a minute.");
  }
}

async function fetchLiveSolPhpQuote(): Promise<CryptoPhpQuote> {
  const providers: Array<{ name: string; load: () => Promise<CryptoPhpQuote> }> = [
    { name: "coingecko", load: fetchCoingeckoSolQuote },
    { name: "coinbase", load: fetchCoinbaseSolQuote },
    { name: "cryptocompare", load: fetchCryptocompareSolQuote },
  ];
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const quote = await provider.load();

      logPaymentDebug("quote-provider-success", {
        phpPerAsset: quote.phpPerAsset,
        provider: provider.name,
        symbol: quote.symbol,
      });

      return quote;
    } catch (error) {
      const message = getErrorMessage(error, "Unknown quote fetch error.");

      failures.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`All live SOL/PHP quote providers failed. ${failures.join(" | ")}`);
}

export async function fetchSolPhpQuote(): Promise<CryptoPhpQuote> {
  if (cachedSolPhpQuote && Date.now() - cachedSolPhpQuote.fetchedAt <= QUOTE_CACHE_TTL_MS) {
    return cachedSolPhpQuote;
  }

  if (!inFlightSolPhpQuotePromise) {
    inFlightSolPhpQuotePromise = fetchLiveSolPhpQuote()
      .then((quote) => {
        cachedSolPhpQuote = { ...quote, fetchedAt: Date.now() };
        return quote;
      })
      .finally(() => {
        inFlightSolPhpQuotePromise = null;
      });
  }

  try {
    return await inFlightSolPhpQuotePromise;
  } catch (error) {
    if (cachedSolPhpQuote && Date.now() - cachedSolPhpQuote.fetchedAt <= STALE_QUOTE_TTL_MS) {
      return {
        phpPerAsset: cachedSolPhpQuote.phpPerAsset,
        quoteSource: `${cachedSolPhpQuote.quoteSource} (cached)`,
        quoteUpdatedAt: cachedSolPhpQuote.quoteUpdatedAt,
        symbol: cachedSolPhpQuote.symbol,
      };
    }

    throw new Error("Unable to load the current SOL/PHP quote right now. Please try again in a minute.");
  }
}

export async function fetchUsdPhpQuote(): Promise<CryptoPhpQuote> {
  if (cachedUsdPhpQuote && Date.now() - cachedUsdPhpQuote.fetchedAt <= QUOTE_CACHE_TTL_MS) {
    return cachedUsdPhpQuote;
  }

  if (!inFlightUsdPhpQuotePromise) {
    inFlightUsdPhpQuotePromise = (async () => {
      const providers: Array<{ name: string; load: () => Promise<CryptoPhpQuote> }> = [
        { name: "coinbase", load: fetchCoinbaseUsdQuote },
        { name: "cryptocompare", load: fetchCryptocompareUsdQuote },
      ];
      const failures: string[] = [];

      for (const provider of providers) {
        try {
          const quote = await provider.load();

          logPaymentDebug("quote-provider-success", {
            phpPerAsset: quote.phpPerAsset,
            provider: provider.name,
            symbol: quote.symbol,
          });

          return quote;
        } catch (error) {
          failures.push(`${provider.name}: ${getErrorMessage(error, "Unknown quote fetch error.")}`);
        }
      }

      throw new Error(`All live USD/PHP quote providers failed. ${failures.join(" | ")}`);
    })()
      .then((quote) => {
        cachedUsdPhpQuote = { ...quote, fetchedAt: Date.now() };
        return quote;
      })
      .finally(() => {
        inFlightUsdPhpQuotePromise = null;
      });
  }

  try {
    return await inFlightUsdPhpQuotePromise;
  } catch (error) {
    if (cachedUsdPhpQuote && Date.now() - cachedUsdPhpQuote.fetchedAt <= STALE_QUOTE_TTL_MS) {
      return {
        phpPerAsset: cachedUsdPhpQuote.phpPerAsset,
        quoteSource: `${cachedUsdPhpQuote.quoteSource} (cached)`,
        quoteUpdatedAt: cachedUsdPhpQuote.quoteUpdatedAt,
        symbol: cachedUsdPhpQuote.symbol,
      };
    }

    throw new Error("Unable to load the current USD/PHP quote right now. Please try again in a minute.");
  }
}

export async function fetchPaymentPhpQuote(
  paymentMethod: PaymentMethod | string,
  options?: {
    allowUnvalidatedMarket?: boolean;
  },
): Promise<CryptoPhpQuote> {
  const config = getPaymentMethodConfig(paymentMethod);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  const cacheKey = `${config.value}:${options?.allowUnvalidatedMarket ? "preview" : "strict"}`;
  const cachedQuote = cachedPaymentPhpQuotes.get(cacheKey);

  if (cachedQuote && Date.now() - cachedQuote.fetchedAt <= QUOTE_CACHE_TTL_MS) {
    return {
      ...cachedQuote,
    };
  }

  if (!inFlightPaymentPhpQuotePromises.has(cacheKey)) {
    inFlightPaymentPhpQuotePromises.set(
      cacheKey,
      fetchLivePaymentPhpQuote(paymentMethod, options)
        .then((quote) => {
          cachedPaymentPhpQuotes.set(cacheKey, {
            ...quote,
            fetchedAt: Date.now(),
          });

          return quote;
        })
        .finally(() => {
          inFlightPaymentPhpQuotePromises.delete(cacheKey);
        }),
    );
  }

  try {
    return await inFlightPaymentPhpQuotePromises.get(cacheKey)!;
  } catch (error) {
    const staleQuote = cachedPaymentPhpQuotes.get(cacheKey);

    if (staleQuote && Date.now() - staleQuote.fetchedAt <= STALE_QUOTE_TTL_MS) {
      logPaymentDebug("payment-quote-stale-cache-fallback", {
        error: getErrorMessage(error, "Unable to load the current payment quote."),
        paymentMethod: cacheKey,
        source: staleQuote.quoteSource,
      });

      return {
        ...staleQuote,
        quoteSource: `${staleQuote.quoteSource} (cached)`,
      };
    }

    throw error;
  }
}

async function fetchLivePaymentPhpQuote(
  paymentMethod: PaymentMethod | string,
  options?: {
    allowUnvalidatedMarket?: boolean;
  },
): Promise<CryptoPhpQuote> {
  const config = getPaymentMethodConfig(paymentMethod);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  const referenceQuote = await fetchPrimaryPaymentQuoteWithFallback(paymentMethod);

  if (options?.allowUnvalidatedMarket) {
    let binanceUsdPerAsset: number;

    try {
      binanceUsdPerAsset = await fetchBinanceUsdPrice(paymentMethod);
    } catch (error) {
      logPaymentDebug("binance-payment-quote-preview-fallback", {
        error: getErrorMessage(error, "Unable to validate the current market price."),
        paymentMethod,
        token: config.label,
      });

      return {
        ...referenceQuote,
        binanceUsdPerAsset: null,
        priceDifferencePercent: null,
        priceTolerancePercent: getPriceDifferenceTolerancePercent(),
        quoteSource: `${referenceQuote.quoteSource}+market_preview`,
        symbol: config.label,
      };
    }

    return validateBinancePriceDifference(
      {
        ...referenceQuote,
        binanceUsdPerAsset,
        symbol: config.label,
      },
      paymentMethod,
    );
  }

  const binanceUsdPerAsset = await fetchBinanceUsdPrice(paymentMethod);

  return validateBinancePriceDifference(
    {
      ...referenceQuote,
      binanceUsdPerAsset,
      symbol: config.label,
    },
    paymentMethod,
  );
}

async function fetchPrimaryPaymentQuoteWithFallback(paymentMethod: PaymentMethod | string): Promise<CryptoPhpQuote> {
  try {
    return await fetchCoingeckoPaymentQuote(paymentMethod);
  } catch (error) {
    const config = getPaymentMethodConfig(paymentMethod);
    const errorMessage = getErrorMessage(error, "Unable to fetch the current CoinGecko payment quote.");

    logPaymentDebug("coingecko-payment-quote-fallback", {
      error: errorMessage,
      paymentMethod,
      token: config?.label,
    });

    if (!config) {
      throw error;
    }

    if (config.tokenType === "ETH") {
      const [ethQuote, usdQuote] = await Promise.all([fetchEthPhpQuote(), fetchUsdPhpQuote()]);
      const usdPhpRate = usdQuote.phpPerAsset;

      return {
        phpPerAsset: ethQuote.phpPerEth,
        usdPerAsset: ethQuote.phpPerEth / usdPhpRate,
        usdPhpRate,
        quoteSource: ethQuote.quoteSource,
        quoteUpdatedAt: ethQuote.quoteUpdatedAt,
        symbol: config.label,
      };
    }

    if (config.tokenType === "SOL") {
      const [solQuote, usdQuote] = await Promise.all([fetchSolPhpQuote(), fetchUsdPhpQuote()]);
      const usdPhpRate = usdQuote.phpPerAsset;

      return {
        phpPerAsset: solQuote.phpPerAsset,
        usdPerAsset: solQuote.phpPerAsset / usdPhpRate,
        usdPhpRate,
        quoteSource: solQuote.quoteSource,
        quoteUpdatedAt: solQuote.quoteUpdatedAt,
        symbol: config.label,
      };
    }

    const usdQuote = await fetchUsdPhpQuote();

    return {
      phpPerAsset: usdQuote.phpPerAsset,
      usdPerAsset: 1,
      usdPhpRate: usdQuote.phpPerAsset,
      quoteSource: usdQuote.quoteSource,
      quoteUpdatedAt: usdQuote.quoteUpdatedAt,
      symbol: config.label,
    };
  }
}

function buildCheckoutMarketDetails(params: {
  totalPhpCents: number;
  paymentMethod: PaymentMethod | string;
  quote: CryptoPhpQuote;
  baseCryptoAmount: string;
}) {
  const config = getPaymentMethodConfig(params.paymentMethod);
  const cryptoSymbol = params.quote.symbol || getPaymentMethodLabel(params.paymentMethod);
  const cryptoDecimals = config?.decimals ?? 18;
  const slippageBufferPercent = getSlippageBufferPercent();
  const bufferedAmount = addCryptoAmountBuffer(params.baseCryptoAmount, slippageBufferPercent, cryptoDecimals);
  const usdPhpRate = params.quote.usdPhpRate || (params.quote.usdPerAsset ? params.quote.phpPerAsset / params.quote.usdPerAsset : null);
  const estimatedUsdValue = usdPhpRate ? params.totalPhpCents / 100 / usdPhpRate : 0;
  const quoteTtlSeconds = getQuoteTtlSeconds();
  const quoteExpiresAt = new Date(Date.now() + quoteTtlSeconds * 1000).toISOString();
  const networkFee = getNetworkFeeEstimate(params.paymentMethod);

  return {
    estimatedUsdValue: estimatedUsdValue.toFixed(2),
    estimatedUsdLabel: formatUsdCurrency(estimatedUsdValue),
    usdPhpRate,
    coingeckoCryptoUsdPrice: params.quote.usdPerAsset ?? null,
    binanceCryptoUsdPrice: params.quote.binanceUsdPerAsset ?? null,
    priceDifferencePercent: params.quote.priceDifferencePercent ?? null,
    slippageBufferPercent,
    slippageBufferLabel: `${slippageBufferPercent.toFixed(2).replace(/\.?0+$/, "")}%`,
    baseCryptoAmount: bufferedAmount.baseAmount,
    baseCryptoLabel: formatCryptoAmountLabel(bufferedAmount.baseAmount, cryptoSymbol),
    requiredCryptoAmount: bufferedAmount.totalAmount,
    requiredCryptoLabel: formatCryptoAmountLabel(bufferedAmount.totalAmount, cryptoSymbol),
    slippageBufferAmount: bufferedAmount.bufferAmount,
    slippageBufferAmountLabel: formatCryptoAmountLabel(bufferedAmount.bufferAmount, cryptoSymbol),
    networkFeeEstimateAmount: networkFee.amount,
    networkFeeEstimateSymbol: networkFee.symbol,
    networkFeeEstimateLabel: formatCryptoAmountLabel(networkFee.amount, networkFee.symbol),
    estimatedTotalLabel: buildEstimatedTotalLabel(bufferedAmount.totalAmount, cryptoSymbol, networkFee, cryptoDecimals),
    quoteExpiresAt,
    quoteTtlSeconds,
  };
}

async function loadActiveCheckoutTaxRule() {
  try {
    return getActiveTaxRule(await loadFreshAdminGeneralSettings());
  } catch (error) {
    console.warn("Unable to load admin tax settings, using default VAT settings.", getErrorMessage(error, "Tax settings unavailable."));

    return getActiveTaxRule(DEFAULT_GENERAL_SETTINGS);
  }
}

async function loadActiveCheckoutSettings(): Promise<AdminGeneralSettings> {
  try {
    return await loadFreshAdminGeneralSettings();
  } catch (error) {
    console.warn("Unable to load checkout availability settings, using defaults.", getErrorMessage(error, "Checkout settings unavailable."));

    return DEFAULT_GENERAL_SETTINGS;
  }
}

function buildCheckoutTaxSummary(basePhpCents: number, activeTaxRule: ActiveTaxRule | null) {
  const taxPhpCents = activeTaxRule ? Math.round((basePhpCents * activeTaxRule.ratePercent) / 100) : 0;

  return {
    taxRuleId: activeTaxRule?.id ?? null,
    taxLabel: activeTaxRule?.label ?? null,
    taxRatePercent: activeTaxRule?.ratePercent ?? 0,
    taxableAmountPhpCents: basePhpCents,
    taxableAmountPhp: phpCentsToDecimalString(basePhpCents),
    taxableAmountPhpLabel: formatPhpCurrencyFromCents(basePhpCents),
    taxPhpCents,
    taxPhp: phpCentsToDecimalString(taxPhpCents),
    taxPhpLabel: formatPhpCurrencyFromCents(taxPhpCents),
    totalPhpCents: basePhpCents + taxPhpCents,
  };
}

export async function getCheckoutPricing(productId: string, quantity: number): Promise<CheckoutPricing> {
  const product = await loadPublishedCatalogProduct(productId);

  if (!product) {
    throw new Error("Selected product was not found.");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error("Quantity must be between 1 and 10.");
  }

  const subtotalPhpCents = getCatalogSubtotalPhpCents(product.pricePhpCents, quantity);
  const activeTaxRule = await loadActiveCheckoutTaxRule();
  const taxSummary = buildCheckoutTaxSummary(subtotalPhpCents, activeTaxRule);
  const quote = await fetchPaymentPhpQuote("evm_eth");
  const baseEth = convertPhpCentsToEthAmount(taxSummary.totalPhpCents, quote.phpPerAsset);
  const marketDetails = buildCheckoutMarketDetails({
    totalPhpCents: taxSummary.totalPhpCents,
    paymentMethod: "evm_eth",
    quote,
    baseCryptoAmount: baseEth,
  });

  return {
    product,
    quantity,
    subtotalPhpCents,
    subtotalPhp: phpCentsToDecimalString(subtotalPhpCents),
    subtotalPhpLabel: formatPhpCurrencyFromCents(subtotalPhpCents),
    taxRuleId: taxSummary.taxRuleId,
    taxLabel: taxSummary.taxLabel,
    taxRatePercent: taxSummary.taxRatePercent,
    taxableAmountPhpCents: taxSummary.taxableAmountPhpCents,
    taxableAmountPhp: taxSummary.taxableAmountPhp,
    taxableAmountPhpLabel: taxSummary.taxableAmountPhpLabel,
    taxPhpCents: taxSummary.taxPhpCents,
    taxPhp: taxSummary.taxPhp,
    taxPhpLabel: taxSummary.taxPhpLabel,
    totalPhpCents: taxSummary.totalPhpCents,
    totalPhp: phpCentsToDecimalString(taxSummary.totalPhpCents),
    totalPhpLabel: formatPhpCurrencyFromCents(taxSummary.totalPhpCents),
    phpPerEth: quote.phpPerAsset,
    phpPerEthLabel: `${formatPhpCurrency(quote.phpPerAsset)} / ETH`,
    requiredEth: marketDetails.requiredCryptoAmount,
    requiredEthLabel: marketDetails.requiredCryptoLabel,
    phpPerCrypto: quote.phpPerAsset,
    phpPerCryptoLabel: `${formatPhpCurrency(quote.phpPerAsset)} / ETH`,
    requiredCryptoAmount: marketDetails.requiredCryptoAmount,
    requiredCryptoLabel: marketDetails.requiredCryptoLabel,
    cryptoSymbol: "ETH",
    cryptoDecimals: 18,
    quoteSource: quote.quoteSource,
    quoteUpdatedAt: quote.quoteUpdatedAt,
    estimatedUsdValue: marketDetails.estimatedUsdValue,
    estimatedUsdLabel: marketDetails.estimatedUsdLabel,
    usdPhpRate: marketDetails.usdPhpRate,
    coingeckoCryptoUsdPrice: marketDetails.coingeckoCryptoUsdPrice,
    binanceCryptoUsdPrice: marketDetails.binanceCryptoUsdPrice,
    priceDifferencePercent: marketDetails.priceDifferencePercent,
    slippageBufferPercent: marketDetails.slippageBufferPercent,
    slippageBufferLabel: marketDetails.slippageBufferLabel,
    baseCryptoAmount: marketDetails.baseCryptoAmount,
    baseCryptoLabel: marketDetails.baseCryptoLabel,
    slippageBufferAmount: marketDetails.slippageBufferAmount,
    slippageBufferAmountLabel: marketDetails.slippageBufferAmountLabel,
    networkFeeEstimateAmount: marketDetails.networkFeeEstimateAmount,
    networkFeeEstimateLabel: marketDetails.networkFeeEstimateLabel,
    networkFeeEstimateSymbol: marketDetails.networkFeeEstimateSymbol,
    estimatedTotalLabel: marketDetails.estimatedTotalLabel,
    quoteExpiresAt: marketDetails.quoteExpiresAt,
    quoteTtlSeconds: marketDetails.quoteTtlSeconds,
  };
}

export async function getBagCheckoutPricing(
  lineItems: CheckoutLineItemInput[],
  options?: {
    shippingAddress?: ShippingAddressInput | null;
    shippingMethodCode?: ShippingMethodCode | null;
    paymentMethod?: PaymentMethod | string | null;
    allowUnvalidatedMarket?: boolean;
    couponCode?: string | null;
    userId?: string | null;
    customerEmail?: string | null;
  },
): Promise<CheckoutBagPricing> {
  if (!lineItems.length) {
    throw new Error("Add at least one bag item before checkout.");
  }

  const pricingItems = await Promise.all(
    lineItems.map(async (lineItem) => {
      const productId = lineItem.productId.trim();
      const selectedSize = lineItem.selectedSize.trim();
      const quantity = Math.floor(lineItem.quantity);

      if (!productId) {
        throw new Error("A bag item is missing its product.");
      }

      if (!selectedSize) {
        throw new Error("A bag item is missing its size.");
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new Error("Each bag item quantity must be between 1 and 10.");
      }

      const product = await loadPublishedCatalogProduct(productId);

      if (!product) {
        throw new Error("One of the selected bag items is no longer available.");
      }

      if (!getProductAvailableSizes(product).includes(selectedSize)) {
        throw new Error(`Selected size ${selectedSize} is unavailable for ${product.name}.`);
      }

      const lineTotalPhpCents = getCatalogSubtotalPhpCents(product.pricePhpCents, quantity);

      return {
        product,
        selectedSize,
        quantity,
        lineTotalPhpCents,
        lineTotalPhp: phpCentsToDecimalString(lineTotalPhpCents),
        lineTotalPhpLabel: formatPhpCurrencyFromCents(lineTotalPhpCents),
      } satisfies CheckoutBagPricingItem;
    }),
  );

  const subtotalPhpCents = pricingItems.reduce((total, item) => total + item.lineTotalPhpCents, 0);
  const checkoutSettings = await loadActiveCheckoutSettings();
  const paymentMethod = options?.paymentMethod || "evm_eth";

  if (!isPaymentMethodEnabled(checkoutSettings, paymentMethod)) {
    throw new Error("This payment method is currently unavailable.");
  }

  const shippingQuote = getCheckoutShippingQuote({
    merchandiseSubtotalPhpCents: subtotalPhpCents,
    address: options?.shippingAddress || {},
    selectedMethodCode: options?.shippingMethodCode || null,
    availabilitySettings: checkoutSettings,
  });
  const shippingFeePhpCents = shippingQuote.shippingFeePhpCents || 0;
  const couponApplication: CouponApplication = await validateCouponForCheckout({
    couponCode: options?.couponCode,
    items: pricingItems,
    subtotalPhpCents,
    shippingFeePhpCents,
    userId: options?.userId,
    customerEmail: options?.customerEmail,
  });
  const activeTaxRule = getActiveTaxRule(checkoutSettings);
  const taxSummary = buildCheckoutTaxSummary(couponApplication.totalAfterDiscountPhpCents, activeTaxRule);
  const totalPhpCents = taxSummary.totalPhpCents;
  const config = getPaymentMethodConfig(paymentMethod);
  const quote = await fetchPaymentPhpQuote(paymentMethod, {
    allowUnvalidatedMarket: options?.allowUnvalidatedMarket,
  });
  const cryptoDecimals = config?.decimals ?? 18;
  const baseCryptoAmount = convertPhpCentsToCryptoAmount(totalPhpCents, quote.phpPerAsset, cryptoDecimals);
  const marketDetails = buildCheckoutMarketDetails({
    totalPhpCents,
    paymentMethod,
    quote,
    baseCryptoAmount,
  });
  const requiredCryptoAmount = marketDetails.requiredCryptoAmount;
  const cryptoSymbol = quote.symbol;

  return {
    items: pricingItems,
    itemCount: pricingItems.length,
    totalQuantity: pricingItems.reduce((total, item) => total + item.quantity, 0),
    subtotalPhpCents,
    subtotalPhp: phpCentsToDecimalString(subtotalPhpCents),
    subtotalPhpLabel: formatPhpCurrencyFromCents(subtotalPhpCents),
    shippingFeePhpCents: shippingQuote.shippingFeePhpCents,
    shippingFeePhp: shippingQuote.shippingFeePhp,
    shippingFeeLabel: shippingQuote.shippingFeeLabel,
    shippingOptions: shippingQuote.shippingOptions,
    shippingMethodCode: shippingQuote.shippingMethodCode,
    shippingMethodLabel: shippingQuote.shippingMethodLabel,
    shippingZone: shippingQuote.shippingZone,
    shippingZoneLabel: shippingQuote.shippingZoneLabel,
    shippingMessage: shippingQuote.message,
    freeShippingApplied: shippingQuote.freeShippingApplied || couponApplication.shippingDiscountPhpCents > 0,
    couponId: couponApplication.couponId,
    couponCode: couponApplication.couponCode,
    couponLabel: couponApplication.couponLabel,
    couponMessage: couponApplication.couponMessage,
    discountPhpCents: couponApplication.discountPhpCents,
    discountPhp: couponApplication.discountPhp,
    discountPhpLabel: couponApplication.discountPhpLabel,
    productDiscountPhpCents: couponApplication.productDiscountPhpCents,
    shippingDiscountPhpCents: couponApplication.shippingDiscountPhpCents,
    totalBeforeDiscountPhpCents: couponApplication.totalBeforeDiscountPhpCents,
    taxRuleId: taxSummary.taxRuleId,
    taxLabel: taxSummary.taxLabel,
    taxRatePercent: taxSummary.taxRatePercent,
    taxableAmountPhpCents: taxSummary.taxableAmountPhpCents,
    taxableAmountPhp: taxSummary.taxableAmountPhp,
    taxableAmountPhpLabel: taxSummary.taxableAmountPhpLabel,
    taxPhpCents: taxSummary.taxPhpCents,
    taxPhp: taxSummary.taxPhp,
    taxPhpLabel: taxSummary.taxPhpLabel,
    totalPhpCents,
    totalPhp: phpCentsToDecimalString(totalPhpCents),
    totalPhpLabel: formatPhpCurrencyFromCents(totalPhpCents),
    normalizedShippingAddress: shippingQuote.normalizedAddress,
    isShippingResolved: shippingQuote.isResolved,
    phpPerEth: quote.phpPerAsset,
    phpPerEthLabel: `${formatPhpCurrency(quote.phpPerAsset)} / ${cryptoSymbol}`,
    requiredEth: requiredCryptoAmount,
    requiredEthLabel: marketDetails.requiredCryptoLabel,
    phpPerCrypto: quote.phpPerAsset,
    phpPerCryptoLabel: `${formatPhpCurrency(quote.phpPerAsset)} / ${cryptoSymbol}`,
    requiredCryptoAmount,
    requiredCryptoLabel: marketDetails.requiredCryptoLabel,
    cryptoSymbol,
    cryptoDecimals,
    quoteSource: quote.quoteSource,
    quoteUpdatedAt: quote.quoteUpdatedAt,
    estimatedUsdValue: marketDetails.estimatedUsdValue,
    estimatedUsdLabel: marketDetails.estimatedUsdLabel,
    usdPhpRate: marketDetails.usdPhpRate,
    coingeckoCryptoUsdPrice: marketDetails.coingeckoCryptoUsdPrice,
    binanceCryptoUsdPrice: marketDetails.binanceCryptoUsdPrice,
    priceDifferencePercent: marketDetails.priceDifferencePercent,
    slippageBufferPercent: marketDetails.slippageBufferPercent,
    slippageBufferLabel: marketDetails.slippageBufferLabel,
    baseCryptoAmount: marketDetails.baseCryptoAmount,
    baseCryptoLabel: marketDetails.baseCryptoLabel,
    slippageBufferAmount: marketDetails.slippageBufferAmount,
    slippageBufferAmountLabel: marketDetails.slippageBufferAmountLabel,
    networkFeeEstimateAmount: marketDetails.networkFeeEstimateAmount,
    networkFeeEstimateLabel: marketDetails.networkFeeEstimateLabel,
    networkFeeEstimateSymbol: marketDetails.networkFeeEstimateSymbol,
    estimatedTotalLabel: marketDetails.estimatedTotalLabel,
    quoteExpiresAt: marketDetails.quoteExpiresAt,
    quoteTtlSeconds: marketDetails.quoteTtlSeconds,
  };
}
