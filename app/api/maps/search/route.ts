import { NextResponse } from "next/server";

// Grab-style address autocomplete: returns a LIST of suggestions (with
// coordinates) for a free-text query, using Mapbox forward geocoding with
// autocomplete enabled. Distinct from /api/maps/geocode (single best match).

const MAPBOX_FORWARD_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const MAX_QUERY_LENGTH = 256;

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
  precision: string;
  components: {
    addressLine1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

type MapboxFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    full_address?: string;
    name?: string;
    place_formatted?: string;
    coordinates?: { latitude?: number; longitude?: number };
    context?: Record<string, { name?: string } | undefined>;
  };
};

type MapboxResponse = { features?: MapboxFeature[] };

function getMapboxToken() {
  return process.env.MAPBOX_ACCESS_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
}

function contextName(context: Record<string, { name?: string } | undefined> | undefined, key: string) {
  const value = context?.[key];
  return typeof value?.name === "string" ? value.name : "";
}

function parseFeature(feature: MapboxFeature): AddressSuggestion | null {
  const lng = feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  const lat = feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const context = feature.properties?.context;
  const name = feature.properties?.name || "";
  const placeFormatted = feature.properties?.place_formatted || "";
  const label = feature.properties?.full_address || [name, placeFormatted].filter(Boolean).join(", ") || name;

  return {
    label,
    lat: Number(lat),
    lng: Number(lng),
    placeId: feature.properties?.mapbox_id || feature.id || null,
    precision: feature.properties?.feature_type || "place",
    components: {
      addressLine1: feature.properties?.feature_type === "address" ? name : feature.properties?.feature_type === "street" ? name : "",
      city: contextName(context, "place") || contextName(context, "locality"),
      province: contextName(context, "region"),
      postalCode: contextName(context, "postcode"),
      country: contextName(context, "country"),
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
  const proximityLat = Number(url.searchParams.get("lat"));
  const proximityLng = Number(url.searchParams.get("lng"));

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const token = getMapboxToken();

  if (!token) {
    return NextResponse.json({ results: [] });
  }

  try {
    const mapboxUrl = new URL(MAPBOX_FORWARD_ENDPOINT);
    mapboxUrl.searchParams.set("q", query);
    mapboxUrl.searchParams.set("access_token", token);
    mapboxUrl.searchParams.set("language", "en");
    mapboxUrl.searchParams.set("autocomplete", "true");
    mapboxUrl.searchParams.set("limit", "6");
    mapboxUrl.searchParams.set("country", "PH");
    mapboxUrl.searchParams.set("types", "address,street,postcode,place,locality,neighborhood");

    if (Number.isFinite(proximityLat) && Number.isFinite(proximityLng)) {
      mapboxUrl.searchParams.set("proximity", `${proximityLng},${proximityLat}`);
    }

    const response = await fetch(mapboxUrl, {
      headers: { "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)" },
    });

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await response.json()) as MapboxResponse;
    const results = (data.features || [])
      .map(parseFeature)
      .filter((result): result is AddressSuggestion => Boolean(result));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
