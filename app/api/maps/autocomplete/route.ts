import { NextResponse } from "next/server";

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 6;
const MAPBOX_FORWARD_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

type AddressComponents = {
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
};

type Suggestion = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  precision?: string;
  provider?: string;
  components?: AddressComponents;
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

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  place_id?: number;
  type?: string;
  address?: Record<string, string | undefined>;
};

function clean(value: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
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

function parseMapboxFeature(feature: MapboxFeature | undefined): Suggestion | null {
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
    `${lat}, ${lng}`;

  return {
    label,
    lat: Number(lat),
    lng: Number(lng),
    placeId: feature.properties?.mapbox_id || feature.id || null,
    precision: feature.properties?.feature_type || "coordinate",
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

async function suggestMapbox(query: string): Promise<Suggestion[]> {
  const token = getMapboxToken();

  if (!token) {
    return [];
  }

  const geocodeUrl = new URL(MAPBOX_FORWARD_ENDPOINT);
  geocodeUrl.searchParams.set("q", query);
  geocodeUrl.searchParams.set("access_token", token);
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("autocomplete", "true");
  geocodeUrl.searchParams.set("limit", String(MAX_RESULTS));
  geocodeUrl.searchParams.set("country", "PH");
  geocodeUrl.searchParams.set("types", "address,street,postcode,place,locality,neighborhood");

  const response = await fetch(geocodeUrl, {
    headers: {
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as MapboxResponse;

  return (data.features || [])
    .map((feature) => parseMapboxFeature(feature))
    .filter((result): result is Suggestion => Boolean(result));
}

function parseNominatimAddress(address: NominatimResult["address"] = {}): AddressComponents {
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

async function suggestNominatim(query: string): Promise<Suggestion[]> {
  const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
  geocodeUrl.searchParams.set("q", query);
  geocodeUrl.searchParams.set("format", "jsonv2");
  geocodeUrl.searchParams.set("limit", String(MAX_RESULTS));
  geocodeUrl.searchParams.set("addressdetails", "1");
  geocodeUrl.searchParams.set("accept-language", "en");
  geocodeUrl.searchParams.set("countrycodes", "ph");

  const response = await fetch(geocodeUrl, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as NominatimResult[];

  return (data || [])
    .map((match): Suggestion | null => {
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
        precision: match?.type || "coordinate",
        provider: "nominatim",
        components: parseNominatimAddress(match?.address),
      };
    })
    .filter((result): result is Suggestion => Boolean(result));
}

function dedupe(results: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = result.label.toLowerCase();

    if (!result.label || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q"));

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    const mapboxResults = await suggestMapbox(query);
    const results = mapboxResults.length ? mapboxResults : await suggestNominatim(query);

    return NextResponse.json({ results: dedupe(results).slice(0, MAX_RESULTS) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
