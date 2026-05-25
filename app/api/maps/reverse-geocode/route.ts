import { NextResponse } from "next/server";

const MAPBOX_REVERSE_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/reverse";

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

type NominatimReverseResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  place_id?: number;
  address?: Record<string, string | undefined>;
};

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

function parseMapboxFeature(feature: MapboxFeature | undefined, fallbackLat: number, fallbackLng: number) {
  if (!feature) {
    return null;
  }

  const lng = feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0] ?? fallbackLng;
  const lat = feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1] ?? fallbackLat;
  const context = feature.properties?.context;
  const label =
    feature.properties?.full_address ||
    [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(", ") ||
    `${fallbackLat}, ${fallbackLng}`;

  return {
    label,
    lat,
    lng,
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

function parseNominatimAddress(address: NominatimReverseResult["address"] = {}) {
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

async function reverseMapbox(lat: number, lng: number) {
  const token = getMapboxToken();

  if (!token) {
    return null;
  }

  const reverseUrl = new URL(MAPBOX_REVERSE_ENDPOINT);
  reverseUrl.searchParams.set("latitude", String(lat));
  reverseUrl.searchParams.set("longitude", String(lng));
  reverseUrl.searchParams.set("access_token", token);
  reverseUrl.searchParams.set("language", "en");
  reverseUrl.searchParams.set("limit", "1");
  reverseUrl.searchParams.set("country", "PH");
  reverseUrl.searchParams.set("types", "address,street,postcode,place,locality,neighborhood");

  const response = await fetch(reverseUrl, {
    headers: {
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as MapboxResponse;
  return parseMapboxFeature(data.features?.[0], lat, lng);
}

async function reverseNominatim(lat: number, lng: number) {
  const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  reverseUrl.searchParams.set("format", "jsonv2");
  reverseUrl.searchParams.set("lat", String(lat));
  reverseUrl.searchParams.set("lon", String(lng));
  reverseUrl.searchParams.set("addressdetails", "1");
  reverseUrl.searchParams.set("accept-language", "en");

  const response = await fetch(reverseUrl, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "VioneHernalStore/1.0 (support@vionehernal.com)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NominatimReverseResult;

  return {
    label: data.display_name || `${lat}, ${lng}`,
    lat: Number(data.lat) || lat,
    lng: Number(data.lon) || lng,
    placeId: data.place_id ? `nominatim:${data.place_id}` : null,
    precision: "coordinate",
    provider: "nominatim",
    components: parseNominatimAddress(data.address),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ result: null }, { status: 400 });
  }

  try {
    const result = await reverseMapbox(lat, lng) || await reverseNominatim(lat, lng);
    return NextResponse.json({ result: result || null });
  } catch {
    return NextResponse.json({ result: null });
  }
}
