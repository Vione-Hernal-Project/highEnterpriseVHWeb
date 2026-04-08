import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getCatalogProduct, getCatalogSubtotalPhpCents } from "@/lib/catalog";
import { getErrorMessage } from "@/lib/http";
import {
  convertPhpCentsToEthAmount,
  formatPhpCurrency,
  formatPhpCurrencyFromCents,
  normalizePaymentAmount,
  phpCentsToDecimalString,
} from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";

const COINGECKO_SIMPLE_PRICE_ENDPOINT =
  process.env.COINGECKO_SIMPLE_PRICE_ENDPOINT?.trim() || "https://api.coingecko.com/api/v3/simple/price";
const COINBASE_EXCHANGE_RATES_ENDPOINT = "https://api.coinbase.com/v2/exchange-rates";
const CRYPTOCOMPARE_PRICE_ENDPOINT = "https://min-api.cryptocompare.com/data/price";

const QUOTE_CACHE_TTL_MS = 60_000;
const STALE_QUOTE_TTL_MS = 15 * 60_000;
const execFileAsync = promisify(execFile);

export type EthPhpQuote = {
  phpPerEth: number;
  quoteSource: string;
  quoteUpdatedAt: string | null;
};

export type CheckoutPricing = {
  product: NonNullable<ReturnType<typeof getCatalogProduct>>;
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

type CachedEthPhpQuote = EthPhpQuote & {
  fetchedAt: number;
};

let cachedEthPhpQuote: CachedEthPhpQuote | null = null;
let inFlightEthPhpQuotePromise: Promise<EthPhpQuote> | null = null;

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

export async function getCheckoutPricing(productId: string, quantity: number): Promise<CheckoutPricing> {
  const product = getCatalogProduct(productId);

  if (!product) {
    throw new Error("Selected product was not found.");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error("Quantity must be between 1 and 10.");
  }

  const subtotalPhpCents = getCatalogSubtotalPhpCents(product.pricePhpCents, quantity);
  const quote = await fetchEthPhpQuote();
  const requiredEth = convertPhpCentsToEthAmount(subtotalPhpCents, quote.phpPerEth);

  return {
    product,
    quantity,
    subtotalPhpCents,
    subtotalPhp: phpCentsToDecimalString(subtotalPhpCents),
    subtotalPhpLabel: formatPhpCurrencyFromCents(subtotalPhpCents),
    phpPerEth: quote.phpPerEth,
    phpPerEthLabel: `${formatPhpCurrency(quote.phpPerEth)} / ETH`,
    requiredEth,
    requiredEthLabel: `${normalizePaymentAmount(requiredEth)} ETH`,
    quoteSource: quote.quoteSource,
    quoteUpdatedAt: quote.quoteUpdatedAt,
  };
}
