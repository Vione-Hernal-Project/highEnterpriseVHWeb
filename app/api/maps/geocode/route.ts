import { NextResponse } from "next/server";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  place_id?: number;
  address?: Record<string, string | undefined>;
  type?: string;
};

const MAX_ADDRESS_LENGTH = 500;
const MAPBOX_FORWARD_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  precision?: string;
  provider?: string;
  components?: {
    addressLine1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

type MapboxFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    full_address?: string;
    name?: string;
    place_formatted?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
    context?: Record<string, { name?: string; mapbox_id?: string } | undefined>;
  };
};

type MapboxResponse = {
  features?: MapboxFeature[];
};
type MapboxContext = NonNullable<NonNullable<MapboxFeature["properties"]>["context"]>;

function clean(value: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, MAX_ADDRESS_LENGTH);
}

function normalizeForMatch(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valuesConflict(requested: string, received: string | undefined) {
  const expected = normalizeForMatch(requested);
  const actual = normalizeForMatch(received);

  if (!expected || !actual) {
    return false;
  }

  return expected !== actual && !expected.includes(actual) && !actual.includes(expected);
}

function getRequestedComponents(url: URL) {
  return {
    city: clean(url.searchParams.get("city")),
    province: clean(url.searchParams.get("province")),
    postalCode: clean(url.searchParams.get("postalCode")),
    country: clean(url.searchParams.get("country")) || "Philippines",
  };
}

function matchesRequestedComponents(result: GeocodeResult | null, requested: ReturnType<typeof getRequestedComponents>) {
  if (!result?.components) {
    return true;
  }

  if (valuesConflict(requested.city, result.components.city)) {
    return false;
  }

  if (valuesConflict(requested.postalCode, result.components.postalCode)) {
    return false;
  }

  if (valuesConflict(requested.country, result.components.country)) {
    return false;
  }

  const localMatch =
    Boolean(requested.city && result.components.city && !valuesConflict(requested.city, result.components.city))
    || Boolean(requested.postalCode && result.components.postalCode && !valuesConflict(requested.postalCode, result.components.postalCode));

  if (!localMatch && requested.province && result.components.province && valuesConflict(requested.province, result.components.province)) {
    return false;
  }

  return true;
}

function uniqueQueries(queries: { query: string; precision: string }[]) {
  const seen = new Set<string>();

  return queries.filter((entry) => {
    const key = entry.query.toLowerCase();

    if (!entry.query || entry.query.length < 6 || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildQueries(url: URL) {
  const address = clean(url.searchParams.get("address"));
  const street = clean(url.searchParams.get("street"));
  const city = clean(url.searchParams.get("city"));
  const province = clean(url.searchParams.get("province"));
  const postalCode = clean(url.searchParams.get("postalCode"));
  const country = clean(url.searchParams.get("country")) || "Philippines";
  const fullAddress = address || [street, city, province, postalCode, country].filter(Boolean).join(", ");

  return uniqueQueries([
    { query: fullAddress, precision: "address" },
    { query: [street, city, province, country].filter(Boolean).join(", "), precision: "street" },
    { query: [postalCode, city, province, country].filter(Boolean).join(", "), precision: "postal" },
    { query: [city, province, country].filter(Boolean).join(", "), precision: "city" },
    { query: [province, country].filter(Boolean).join(", "), precision: "province" },
  ]);
}

function likelyPhilippines(query: string) {
  return /\b(ph|philippines|taytay|rizal|makati|manila|cebu|davao)\b/i.test(query);
}

function getMapboxToken() {
  return process.env.MAPBOX_ACCESS_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
}

function readContextName(context: MapboxContext | undefined, key: string) {
  if (!context || typeof context !== "object") {
    return "";
  }

  const value = (context as Record<string, { name?: string } | undefined>)[key];
  return typeof value?.name === "string" ? value.name : "";
}

function parseMapboxFeature(feature: MapboxFeature | undefined, fallbackQuery: string, fallbackPrecision: string): GeocodeResult | null {
  if (!feature) {
    return null;
  }

  const lng = feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  const lat = feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const context = feature.properties?.context;
  const label =
    feature.properties?.full_address ||
    [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(", ") ||
    fallbackQuery;

  return {
    label,
    lat: Number(lat),
    lng: Number(lng),
    placeId: feature.properties?.mapbox_id || feature.id || null,
    precision: feature.properties?.feature_type || fallbackPrecision,
    provider: "mapbox",
    components: {
      addressLine1: feature.properties?.feature_type === "address" ? feature.properties?.name : "",
      city: readContextName(context, "place") || readContextName(context, "locality"),
      province: readContextName(context, "region"),
      postalCode: readContextName(context, "postcode"),
      country: readContextName(context, "country"),
    },
  };
}

async function lookupMapbox(query: string, precision: string, requestedComponents: ReturnType<typeof getRequestedComponents>) {
  const token = getMapboxToken();

  if (!token) {
    return null;
  }

  const geocodeUrl = new URL(MAPBOX_FORWARD_ENDPOINT);
  geocodeUrl.searchParams.set("q", query);
  geocodeUrl.searchParams.set("access_token", token);
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("autocomplete", "false");
  geocodeUrl.searchParams.set("limit", "5");
  geocodeUrl.searchParams.set("country", "PH");
  geocodeUrl.searchParams.set("types", "address,street,postcode,place,locality,neighborhood");

  const response = await fetch(geocodeUrl, {
    headers: {
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as MapboxResponse;
  const matches = (data.features || [])
    .map((feature) => parseMapboxFeature(feature, query, precision))
    .filter((result): result is GeocodeResult => Boolean(result))
    .filter((result) => matchesRequestedComponents(result, requestedComponents));

  return matches[0] || null;
}

function parseNominatimAddress(address: NominatimResult["address"] = {}) {
  const addressLine1 = [address.house_number, address.road || address.pedestrian || address.footway || address.neighbourhood || address.suburb]
    .filter(Boolean)
    .join(" ");

  return {
    addressLine1,
    city: address.city || address.town || address.municipality || address.village || "",
    province: address.state || address.province || address.region || "",
    postalCode: address.postcode || "",
    country: address.country || "",
  };
}

async function lookupNominatim(query: string, precision: string) {
  const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
  geocodeUrl.searchParams.set("q", query);
  geocodeUrl.searchParams.set("format", "jsonv2");
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("addressdetails", "1");
  geocodeUrl.searchParams.set("namedetails", "1");
  geocodeUrl.searchParams.set("accept-language", "en");

  if (likelyPhilippines(query)) {
    geocodeUrl.searchParams.set("countrycodes", "ph");
  }

  const response = await fetch(geocodeUrl, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NominatimResult[];
  const match = data[0];
  const lat = Number(match?.lat);
  const lng = Number(match?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    label: match?.display_name || query,
    lat,
    lng,
    placeId: match?.place_id ? `nominatim:${match.place_id}` : null,
    precision: inferNominatimPrecision(match, precision),
    provider: "nominatim",
    components: parseNominatimAddress(match?.address),
  };
}

function inferNominatimPrecision(match: NominatimResult | undefined, fallbackPrecision: string) {
  const address = match?.address || {};

  if (address.house_number && (address.road || address.pedestrian || address.footway)) {
    return "address";
  }

  if (address.road || address.pedestrian || address.footway) {
    return "street";
  }

  if (address.postcode) {
    return "postcode";
  }

  if (address.neighbourhood || address.suburb) {
    return "neighborhood";
  }

  if (address.city || address.town || address.municipality || address.village) {
    return "place";
  }

  if (address.state || address.province || address.region) {
    return "region";
  }

  return match?.type || fallbackPrecision;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queries = buildQueries(url);
  const requestedComponents = getRequestedComponents(url);

  if (queries.length === 0) {
    return NextResponse.json({ result: null });
  }

  try {
    for (const entry of queries) {
      const result = await lookupMapbox(entry.query, entry.precision, requestedComponents) || await lookupNominatim(entry.query, entry.precision);

      if (result && matchesRequestedComponents(result, requestedComponents)) {
        return NextResponse.json({ result });
      }
    }

    return NextResponse.json({ result: null });
  } catch {
    return NextResponse.json({ result: null });
  }
}
