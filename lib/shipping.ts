import { formatPhpCurrencyFromCents, parsePhpInputToCents, phpCentsToDecimalString } from "@/lib/payments/amounts";
import usePostalPH, { type PlaceProps } from "use-postal-ph";

export type ShippingZoneCode = "metro_manila" | "luzon" | "visayas" | "mindanao";
export type ShippingMethodCode = "standard" | "express";

export type ShippingAddressInput = {
  address1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type ProvinceShippingZone = {
  province: string;
  zone: ShippingZoneCode;
  aliases?: string[];
};

type CityShippingLocality = {
  city: string;
  province: string;
  zone: ShippingZoneCode;
  postalCodes?: string[];
  postalPrefixes?: string[];
  aliases?: string[];
};

type ShippingOption = {
  code: ShippingMethodCode;
  label: string;
  feePhpCents: number;
  feePhp: string;
  feeLabel: string;
  description: string;
};

export type ResolvedShippingAddress = {
  address1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  zone: ShippingZoneCode | null;
  zoneLabel: string | null;
};

export type ShippingQuote = {
  isResolved: boolean;
  message: string;
  normalizedAddress: ResolvedShippingAddress;
  shippingZone: ShippingZoneCode | null;
  shippingZoneLabel: string | null;
  shippingMethodCode: ShippingMethodCode | null;
  shippingMethodLabel: string | null;
  shippingOptions: ShippingOption[];
  shippingFeePhpCents: number | null;
  shippingFeePhp: string | null;
  shippingFeeLabel: string;
  freeShippingApplied: boolean;
};

export type PostalAutofillStatus = "empty" | "incomplete" | "matched" | "not_found";

export type PostalAutofillResult = {
  status: PostalAutofillStatus;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  zone: ShippingZoneCode | null;
  zoneLabel: string | null;
  message: string;
};

const DEFAULT_SHIPPING_RATE_PHP = {
  metroManila: 180,
  luzon: 220,
  visayas: 260,
  mindanao: 320,
  expressSurcharge: 120,
  freeShippingThreshold: 5000,
} as const;

const SHIPPING_PENDING_MESSAGE = "Shipping will be calculated after completing your address.";
const POSTAL_AUTOFILL_DEFAULT_MESSAGE = "Enter a 4-digit Philippine postal code to autofill city and province.";
const POSTAL_AUTOFILL_INVALID_MESSAGE = "Postal code not recognized yet. You can continue entering the address manually.";

const SHIPPING_ZONE_LABELS: Record<ShippingZoneCode, string> = {
  metro_manila: "Metro Manila",
  luzon: "Luzon",
  visayas: "Visayas",
  mindanao: "Mindanao",
};

const SHIPPING_PROVINCES: ProvinceShippingZone[] = [
  { province: "Metro Manila", zone: "metro_manila", aliases: ["NCR", "National Capital Region"] },
  { province: "Abra", zone: "luzon" },
  { province: "Albay", zone: "luzon" },
  { province: "Apayao", zone: "luzon" },
  { province: "Aurora", zone: "luzon" },
  { province: "Bataan", zone: "luzon" },
  { province: "Batanes", zone: "luzon" },
  { province: "Batangas", zone: "luzon" },
  { province: "Benguet", zone: "luzon" },
  { province: "Bulacan", zone: "luzon" },
  { province: "Cagayan", zone: "luzon" },
  { province: "Camarines Norte", zone: "luzon" },
  { province: "Camarines Sur", zone: "luzon" },
  { province: "Catanduanes", zone: "luzon" },
  { province: "Cavite", zone: "luzon" },
  { province: "Ifugao", zone: "luzon" },
  { province: "Ilocos Norte", zone: "luzon" },
  { province: "Ilocos Sur", zone: "luzon" },
  { province: "Isabela", zone: "luzon" },
  { province: "Kalinga", zone: "luzon" },
  { province: "La Union", zone: "luzon" },
  { province: "Laguna", zone: "luzon" },
  { province: "Marinduque", zone: "luzon" },
  { province: "Masbate", zone: "luzon" },
  { province: "Mountain Province", zone: "luzon" },
  { province: "Nueva Ecija", zone: "luzon" },
  { province: "Nueva Vizcaya", zone: "luzon" },
  { province: "Occidental Mindoro", zone: "luzon" },
  { province: "Oriental Mindoro", zone: "luzon" },
  { province: "Palawan", zone: "luzon" },
  { province: "Pampanga", zone: "luzon" },
  { province: "Pangasinan", zone: "luzon" },
  { province: "Quezon", zone: "luzon" },
  { province: "Quirino", zone: "luzon" },
  { province: "Rizal", zone: "luzon" },
  { province: "Romblon", zone: "luzon" },
  { province: "Sorsogon", zone: "luzon" },
  { province: "Tarlac", zone: "luzon" },
  { province: "Zambales", zone: "luzon" },
  { province: "Aklan", zone: "visayas" },
  { province: "Antique", zone: "visayas" },
  { province: "Biliran", zone: "visayas" },
  { province: "Bohol", zone: "visayas" },
  { province: "Capiz", zone: "visayas" },
  { province: "Cebu", zone: "visayas" },
  { province: "Eastern Samar", zone: "visayas" },
  { province: "Guimaras", zone: "visayas" },
  { province: "Iloilo", zone: "visayas" },
  { province: "Leyte", zone: "visayas" },
  { province: "Negros Occidental", zone: "visayas" },
  { province: "Negros Oriental", zone: "visayas" },
  { province: "Northern Samar", zone: "visayas" },
  { province: "Samar", zone: "visayas" },
  { province: "Siquijor", zone: "visayas" },
  { province: "Southern Leyte", zone: "visayas" },
  { province: "Agusan del Norte", zone: "mindanao" },
  { province: "Agusan del Sur", zone: "mindanao" },
  { province: "Basilan", zone: "mindanao" },
  { province: "Bukidnon", zone: "mindanao" },
  { province: "Camiguin", zone: "mindanao" },
  { province: "Cotabato", zone: "mindanao" },
  { province: "Davao de Oro", zone: "mindanao", aliases: ["Compostela Valley"] },
  { province: "Davao del Norte", zone: "mindanao" },
  { province: "Davao del Sur", zone: "mindanao" },
  { province: "Davao Occidental", zone: "mindanao" },
  { province: "Davao Oriental", zone: "mindanao" },
  { province: "Dinagat Islands", zone: "mindanao" },
  { province: "Lanao del Norte", zone: "mindanao" },
  { province: "Lanao del Sur", zone: "mindanao" },
  { province: "Maguindanao del Norte", zone: "mindanao" },
  { province: "Maguindanao del Sur", zone: "mindanao" },
  { province: "Misamis Occidental", zone: "mindanao" },
  { province: "Misamis Oriental", zone: "mindanao" },
  { province: "Sarangani", zone: "mindanao" },
  { province: "South Cotabato", zone: "mindanao" },
  { province: "Sultan Kudarat", zone: "mindanao" },
  { province: "Sulu", zone: "mindanao" },
  { province: "Surigao del Norte", zone: "mindanao" },
  { province: "Surigao del Sur", zone: "mindanao" },
  { province: "Tawi-Tawi", zone: "mindanao" },
  { province: "Zamboanga del Norte", zone: "mindanao" },
  { province: "Zamboanga del Sur", zone: "mindanao" },
  { province: "Zamboanga Sibugay", zone: "mindanao" },
];

const SHIPPING_LOCALITIES: CityShippingLocality[] = [
  { city: "Manila", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1000"], postalPrefixes: ["10"] },
  { city: "Quezon City", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1100"], postalPrefixes: ["11"], aliases: ["QC"] },
  { city: "Makati", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1200"], postalPrefixes: ["12"] },
  { city: "Pasay", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1300"], postalPrefixes: ["13"] },
  { city: "Caloocan", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1400"], postalPrefixes: ["14"] },
  { city: "Malabon", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1470"], postalPrefixes: ["14"] },
  { city: "Navotas", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1485"], postalPrefixes: ["14"] },
  { city: "Valenzuela", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1440"], postalPrefixes: ["14"] },
  { city: "San Juan", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1500"], postalPrefixes: ["15"] },
  { city: "Mandaluyong", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1550"], postalPrefixes: ["15"] },
  { city: "Pasig", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1600"], postalPrefixes: ["16"] },
  { city: "Taguig", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1630"], postalPrefixes: ["16"] },
  { city: "Pateros", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1620"], postalPrefixes: ["16"] },
  { city: "Paranaque", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1700"], postalPrefixes: ["17"], aliases: ["Parañaque"] },
  { city: "Las Pinas", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1740"], postalPrefixes: ["17"], aliases: ["Las Piñas"] },
  { city: "Muntinlupa", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1770"], postalPrefixes: ["17"] },
  { city: "Marikina", province: "Metro Manila", zone: "metro_manila", postalCodes: ["1800"], postalPrefixes: ["18"] },
  { city: "Antipolo", province: "Rizal", zone: "luzon", postalCodes: ["1870"] },
  { city: "Cainta", province: "Rizal", zone: "luzon", postalCodes: ["1900"] },
  { city: "Taytay", province: "Rizal", zone: "luzon", postalCodes: ["1920"] },
  { city: "Angeles", province: "Pampanga", zone: "luzon" },
  { city: "Baguio", province: "Benguet", zone: "luzon" },
  { city: "Batangas City", province: "Batangas", zone: "luzon", aliases: ["Batangas"] },
  { city: "Calamba", province: "Laguna", zone: "luzon" },
  { city: "Cavite City", province: "Cavite", zone: "luzon", aliases: ["Cavite"] },
  { city: "Legazpi", province: "Albay", zone: "luzon" },
  { city: "Lucena", province: "Quezon", zone: "luzon" },
  { city: "Puerto Princesa", province: "Palawan", zone: "luzon" },
  { city: "San Fernando", province: "Pampanga", zone: "luzon" },
  { city: "Santa Rosa", province: "Laguna", zone: "luzon", aliases: ["Sta Rosa", "Sta. Rosa"] },
  { city: "Bacolod", province: "Negros Occidental", zone: "visayas" },
  { city: "Cebu City", province: "Cebu", zone: "visayas", aliases: ["Cebu"] },
  { city: "Dumaguete", province: "Negros Oriental", zone: "visayas" },
  { city: "Iloilo City", province: "Iloilo", zone: "visayas", aliases: ["Iloilo"] },
  { city: "Tacloban", province: "Leyte", zone: "visayas" },
  { city: "Tagbilaran", province: "Bohol", zone: "visayas" },
  { city: "Butuan", province: "Agusan del Norte", zone: "mindanao" },
  { city: "Cagayan de Oro", province: "Misamis Oriental", zone: "mindanao", aliases: ["CDO"] },
  { city: "Davao City", province: "Davao del Sur", zone: "mindanao", aliases: ["Davao"] },
  { city: "General Santos", province: "South Cotabato", zone: "mindanao", aliases: ["GenSan", "General Santos City"] },
  { city: "Zamboanga City", province: "Zamboanga del Sur", zone: "mindanao", aliases: ["Zamboanga"] },
];

const philippinePostalLookup = usePostalPH();
let postalCodeLookupCache: Map<string, CityShippingLocality> | null = null;

function normalizeToken(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string | null | undefined) {
  return (value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCountry(value: string | null | undefined) {
  const normalized = normalizeToken(value);

  if (!normalized || normalized === "ph" || normalized === "philippines" || normalized === "the philippines") {
    return "Philippines";
  }

  return titleCase(value);
}

function normalizePostalCode(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "").slice(0, 4);
}

function readShippingRatePhpCents(envKey: string, fallbackPhp: number) {
  return parsePhpInputToCents(process.env[envKey] || String(fallbackPhp));
}

function getShippingConfig() {
  return {
    freeShippingThresholdPhpCents: readShippingRatePhpCents(
      "NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_PHP",
      DEFAULT_SHIPPING_RATE_PHP.freeShippingThreshold,
    ),
    zoneRatePhpCents: {
      metro_manila: readShippingRatePhpCents("NEXT_PUBLIC_SHIPPING_METRO_MANILA_PHP", DEFAULT_SHIPPING_RATE_PHP.metroManila),
      luzon: readShippingRatePhpCents("NEXT_PUBLIC_SHIPPING_LUZON_PHP", DEFAULT_SHIPPING_RATE_PHP.luzon),
      visayas: readShippingRatePhpCents("NEXT_PUBLIC_SHIPPING_VISAYAS_PHP", DEFAULT_SHIPPING_RATE_PHP.visayas),
      mindanao: readShippingRatePhpCents("NEXT_PUBLIC_SHIPPING_MINDANAO_PHP", DEFAULT_SHIPPING_RATE_PHP.mindanao),
    } satisfies Record<ShippingZoneCode, number>,
    expressSurchargePhpCents: readShippingRatePhpCents(
      "NEXT_PUBLIC_SHIPPING_EXPRESS_SURCHARGE_PHP",
      DEFAULT_SHIPPING_RATE_PHP.expressSurcharge,
    ),
  };
}

function matchesAlias(input: string, aliases: string[]) {
  return aliases.some((alias) => {
    const normalizedAlias = normalizeToken(alias);
    return input === normalizedAlias || input.includes(normalizedAlias) || normalizedAlias.includes(input);
  });
}

function setPostalCodeLookupEntry(lookup: Map<string, CityShippingLocality>, locality: CityShippingLocality | null) {
  if (!locality) {
    return;
  }

  (locality.postalCodes || []).forEach((postalCode) => {
    const normalizedPostalCode = normalizePostalCode(postalCode);

    if (!normalizedPostalCode || lookup.has(normalizedPostalCode)) {
      return;
    }

    lookup.set(normalizedPostalCode, {
      ...locality,
      postalCodes: [normalizedPostalCode],
    });
  });
}

function mapPostalLookupPlaceToLocality(place: PlaceProps) {
  const postalCode = normalizePostalCode(place.post_code?.toString());

  if (!postalCode) {
    return null;
  }

  const region = normalizeToken(place.region);

  if (region === "ncr") {
    const city = (place.location || "").trim();

    if (!city) {
      return null;
    }

    return {
      city,
      province: "Metro Manila",
      zone: "metro_manila" as const,
      postalCodes: [postalCode],
    };
  }

  const provinceMatch = resolveProvinceMatch(place.location || "");
  const city = (place.municipality || place.location || "").trim();

  if (!city || !provinceMatch) {
    return null;
  }

  return {
    city,
    province: provinceMatch.province,
    zone: provinceMatch.zone,
    postalCodes: [postalCode],
  };
}

function getPostalCodeLookup() {
  if (postalCodeLookupCache) {
    return postalCodeLookupCache;
  }

  const lookup = new Map<string, CityShippingLocality>();

  SHIPPING_LOCALITIES.forEach((locality) => {
    setPostalCodeLookupEntry(lookup, locality);
  });

  const providerResult = philippinePostalLookup.fetchDataLists({ limit: 5000 });

  providerResult.data.forEach((place) => {
    setPostalCodeLookupEntry(lookup, mapPostalLookupPlaceToLocality(place));
  });

  postalCodeLookupCache = lookup;

  return lookup;
}

function resolveLocalityByPostalCode(postalCode: string) {
  if (!postalCode) {
    return null;
  }

  const exactMatch = getPostalCodeLookup().get(postalCode);

  if (exactMatch) {
    return exactMatch;
  }

  return (
    SHIPPING_LOCALITIES.find((locality) =>
      (locality.postalPrefixes || []).some((prefix) => postalCode.startsWith(prefix)),
    ) || null
  );
}

export function resolveShippingPostalAutofill(input: Pick<ShippingAddressInput, "postalCode" | "country">): PostalAutofillResult {
  const postalCode = normalizePostalCode(input.postalCode);
  const country = normalizeCountry(input.country);

  if (normalizeToken(country) !== "philippines") {
    return {
      status: postalCode ? "not_found" : "empty",
      postalCode,
      city: "",
      province: "",
      country,
      zone: null,
      zoneLabel: null,
      message: "Postal code autofill is currently available for Philippine addresses only.",
    };
  }

  if (!postalCode) {
    return {
      status: "empty",
      postalCode,
      city: "",
      province: "",
      country,
      zone: null,
      zoneLabel: null,
      message: POSTAL_AUTOFILL_DEFAULT_MESSAGE,
    };
  }

  if (postalCode.length < 4) {
    return {
      status: "incomplete",
      postalCode,
      city: "",
      province: "",
      country,
      zone: null,
      zoneLabel: null,
      message: POSTAL_AUTOFILL_DEFAULT_MESSAGE,
    };
  }

  const locality = resolveLocalityByPostalCode(postalCode);

  if (!locality) {
    return {
      status: "not_found",
      postalCode,
      city: "",
      province: "",
      country,
      zone: null,
      zoneLabel: null,
      message: POSTAL_AUTOFILL_INVALID_MESSAGE,
    };
  }

  return {
    status: "matched",
    postalCode,
    city: locality.city,
    province: locality.province,
    country,
    zone: locality.zone,
    zoneLabel: SHIPPING_ZONE_LABELS[locality.zone],
    message: `${locality.city}, ${locality.province}${SHIPPING_ZONE_LABELS[locality.zone] ? ` · ${SHIPPING_ZONE_LABELS[locality.zone]}` : ""}`,
  };
}

function resolveLocalityByCity(city: string) {
  const normalizedCity = normalizeToken(city);

  if (!normalizedCity) {
    return null;
  }

  return (
    SHIPPING_LOCALITIES.find((locality) => {
      const localityAliases = [locality.city, ...(locality.aliases || [])];
      return matchesAlias(normalizedCity, localityAliases);
    }) || null
  );
}

function resolveProvinceMatch(province: string) {
  const normalizedProvince = normalizeToken(province);

  if (!normalizedProvince) {
    return null;
  }

  return (
    SHIPPING_PROVINCES.find((entry) => {
      const aliases = [entry.province, ...(entry.aliases || [])];
      return matchesAlias(normalizedProvince, aliases);
    }) || null
  );
}

export function resolveShippingAddress(input: ShippingAddressInput): ResolvedShippingAddress {
  const address1 = (input.address1 || "").trim();
  const postalCode = normalizePostalCode(input.postalCode);
  const country = normalizeCountry(input.country);
  const localityFromPostalCode = resolveLocalityByPostalCode(postalCode);
  const localityFromCity = resolveLocalityByCity(input.city || "");
  const provinceMatch = resolveProvinceMatch(input.province || "");

  const matchedLocality = localityFromPostalCode || localityFromCity;
  const province = matchedLocality?.province || provinceMatch?.province || titleCase(input.province);
  const zone = matchedLocality?.zone || provinceMatch?.zone || null;
  const city = matchedLocality?.city || titleCase(input.city);

  return {
    address1,
    city,
    province,
    postalCode,
    country,
    zone,
    zoneLabel: zone ? SHIPPING_ZONE_LABELS[zone] : null,
  };
}

export function buildNormalizedShippingAddress(address: ShippingAddressInput) {
  const resolved = resolveShippingAddress(address);

  return [resolved.address1, resolved.city, resolved.province, resolved.postalCode, resolved.country]
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(", ");
}

export function getShippingMethodLabel(methodCode: ShippingMethodCode) {
  return methodCode === "express" ? "Express Shipping" : "Standard Shipping";
}

export function getCheckoutShippingQuote(params: {
  merchandiseSubtotalPhpCents: number;
  address: ShippingAddressInput;
  selectedMethodCode?: ShippingMethodCode | null;
}): ShippingQuote {
  const resolvedAddress = resolveShippingAddress(params.address);

  if (normalizeToken(resolvedAddress.country) !== "philippines") {
    return {
      isResolved: false,
      message: SHIPPING_PENDING_MESSAGE,
      normalizedAddress: resolvedAddress,
      shippingZone: null,
      shippingZoneLabel: null,
      shippingMethodCode: null,
      shippingMethodLabel: null,
      shippingOptions: [],
      shippingFeePhpCents: null,
      shippingFeePhp: null,
      shippingFeeLabel: "To be calculated",
      freeShippingApplied: false,
    };
  }

  if (!resolvedAddress.zone) {
    return {
      isResolved: false,
      message: SHIPPING_PENDING_MESSAGE,
      normalizedAddress: resolvedAddress,
      shippingZone: null,
      shippingZoneLabel: null,
      shippingMethodCode: null,
      shippingMethodLabel: null,
      shippingOptions: [],
      shippingFeePhpCents: null,
      shippingFeePhp: null,
      shippingFeeLabel: "To be calculated",
      freeShippingApplied: false,
    };
  }

  const config = getShippingConfig();
  const zoneRatePhpCents = config.zoneRatePhpCents[resolvedAddress.zone];
  const freeShippingApplied = params.merchandiseSubtotalPhpCents >= config.freeShippingThresholdPhpCents;
  const standardFeePhpCents = freeShippingApplied ? 0 : zoneRatePhpCents;
  const expressFeePhpCents =
    (freeShippingApplied ? 0 : zoneRatePhpCents) + config.expressSurchargePhpCents;

  const shippingOptions: ShippingOption[] = [
    {
      code: "standard",
      label: getShippingMethodLabel("standard"),
      feePhpCents: standardFeePhpCents,
      feePhp: phpCentsToDecimalString(standardFeePhpCents),
      feeLabel: formatPhpCurrencyFromCents(standardFeePhpCents),
      description: freeShippingApplied
        ? `Free standard shipping unlocked for ${resolvedAddress.zoneLabel}.`
        : `${resolvedAddress.zoneLabel} standard delivery.`,
    },
    {
      code: "express",
      label: getShippingMethodLabel("express"),
      feePhpCents: expressFeePhpCents,
      feePhp: phpCentsToDecimalString(expressFeePhpCents),
      feeLabel: formatPhpCurrencyFromCents(expressFeePhpCents),
      description: `${resolvedAddress.zoneLabel} express delivery.`,
    },
  ];

  const selectedMethodCode =
    params.selectedMethodCode && shippingOptions.some((option) => option.code === params.selectedMethodCode)
      ? params.selectedMethodCode
      : "standard";
  const selectedOption = shippingOptions.find((option) => option.code === selectedMethodCode) || shippingOptions[0];

  return {
    isResolved: true,
    message: freeShippingApplied
      ? `Free standard shipping is active for ${resolvedAddress.zoneLabel}.`
      : `${resolvedAddress.zoneLabel} shipping has been applied.`,
    normalizedAddress: resolvedAddress,
    shippingZone: resolvedAddress.zone,
    shippingZoneLabel: resolvedAddress.zoneLabel,
    shippingMethodCode: selectedMethodCode,
    shippingMethodLabel: selectedOption.label,
    shippingOptions,
    shippingFeePhpCents: selectedOption.feePhpCents,
    shippingFeePhp: selectedOption.feePhp,
    shippingFeeLabel: selectedOption.feeLabel,
    freeShippingApplied,
  };
}
