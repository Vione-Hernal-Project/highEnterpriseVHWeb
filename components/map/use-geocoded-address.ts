"use client";

import { useEffect, useState } from "react";

export type GeocodeAddressComponents = {
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  precision?: string;
  provider?: string;
  components?: GeocodeAddressComponents;
};

export function isPreciseGeocodeResult(result: GeocodeResult | null | undefined) {
  return result?.precision === "address";
}

type GeocodeResponse = {
  result: GeocodeResult | null;
};

type StructuredAddress = {
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
};

type GeocodeStatus = "idle" | "loading" | "found" | "not-found" | "error";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function addParam(params: URLSearchParams, key: string, value: string | undefined) {
  const normalized = normalize(value || "");

  if (normalized) {
    params.set(key, normalized);
  }
}

export function useGeocodedAddress(
  address: string,
  {
    debounceMs = 650,
    enabled = true,
    structured,
  }: { debounceMs?: number; enabled?: boolean; structured?: StructuredAddress } = {},
) {
  const normalizedAddress = address.trim().replace(/\s+/g, " ");
  const structuredSignature = JSON.stringify({
    street: normalize(structured?.street || ""),
    city: normalize(structured?.city || ""),
    province: normalize(structured?.province || ""),
    postalCode: normalize(structured?.postalCode || ""),
    country: normalize(structured?.country || ""),
  });
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GeocodeStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const structuredAddress = structuredSignature ? (JSON.parse(structuredSignature) as StructuredAddress) : undefined;

    if (!enabled || normalizedAddress.length < 6) {
      setResult(null);
      setLoading(false);
      setStatus("idle");
      return;
    }

    setResult(null);
    setLoading(true);
    setStatus("loading");

    const timeoutId = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ address: normalizedAddress });

        addParam(params, "street", structuredAddress?.street);
        addParam(params, "city", structuredAddress?.city);
        addParam(params, "province", structuredAddress?.province);
        addParam(params, "postalCode", structuredAddress?.postalCode);
        addParam(params, "country", structuredAddress?.country);

        const response = await fetch(`/api/maps/geocode?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as GeocodeResponse | null;
        const nextResult = payload?.result || null;

        if (!cancelled) {
          setResult(nextResult);
          setStatus(nextResult ? "found" : "not-found");
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          setStatus("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, enabled, normalizedAddress, structuredSignature]);

  return { result, loading, status };
}
