import { NextResponse } from "next/server";

// Grab-style address autocomplete: returns a LIST of suggestions (with
// coordinates) for a free-text query, using Mapbox forward geocoding with
// autocomplete enabled. Distinct from /api/maps/geocode (single best match).

const MAPBOX_FORWARD_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const MAX_QUERY_LENGTH = 256;
// When the user's area is known, only keep suggestions within this radius so a
// same-named street in a different province/city is filtered out.
const MAX_RESULT_KM = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

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
    const parsed = (data.features || [])
      .map(parseFeature)
      .filter((result): result is AddressSuggestion => Boolean(result));

    // When we know the user's area (proximity), drop results that are far away
    // (e.g. a same-named street in another province) so the list stays relevant.
    const hasProximity = Number.isFinite(proximityLat) && Number.isFinite(proximityLng);
    const results = hasProximity
      ? parsed.filter((result) => haversineKm(proximityLat, proximityLng, result.lat, result.lng) <= MAX_RESULT_KM)
      : parsed;

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
