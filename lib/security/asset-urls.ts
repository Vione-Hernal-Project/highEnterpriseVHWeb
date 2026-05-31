const PRODUCT_MEDIA_BUCKET = "product-media";
const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/`;
const ALLOWED_PUBLIC_ASSET_EXTENSIONS = new Set([".ico", ".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_PRODUCT_MEDIA_PREFIXES = ["banners/", "blog/", "branding/", "collections/", "pages/", "products/", "reviews/"];

function getConfiguredSupabaseOrigin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    return "";
  }

  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
}

function decodePathSafely(value: string) {
  let decoded = value;

  for (let index = 0; index < 3; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);

      if (nextDecoded === decoded) {
        return decoded;
      }

      decoded = nextDecoded;
    } catch {
      return null;
    }
  }

  return decoded;
}

function isUnsafePath(value: string) {
  const decoded = decodePathSafely(value.replace(/\\/g, "/"));

  return !decoded || decoded.includes("\0") || /(^|\/)\.\.?($|\/)/.test(decoded);
}

function extensionFromPathname(pathname: string) {
  const lastDot = pathname.lastIndexOf(".");

  return lastDot >= 0 ? pathname.slice(lastDot).toLowerCase() : "";
}

export function contentTypeForPublicAssetUrl(value: string) {
  const pathname = value.split("?")[0]?.toLowerCase() || "";

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";

  return "image/x-icon";
}

export function isSafeLocalPublicAssetPath(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || isUnsafePath(trimmed)) {
    return false;
  }

  try {
    const url = new URL(trimmed, "https://local.invalid");
    const extension = extensionFromPathname(url.pathname);

    return url.origin === "https://local.invalid" && url.pathname.startsWith("/assets/") && ALLOWED_PUBLIC_ASSET_EXTENSIONS.has(extension);
  } catch {
    return false;
  }
}

export function getStorageObjectPathFromPublicUrl(value: string) {
  try {
    const url = new URL(value);
    const markerIndex = url.pathname.indexOf(STORAGE_PUBLIC_MARKER);

    if (markerIndex < 0) {
      return null;
    }

    const objectPath = url.pathname.slice(markerIndex + STORAGE_PUBLIC_MARKER.length);

    if (isUnsafePath(objectPath)) {
      return null;
    }

    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
}

export function isAllowedProductMediaUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (isSafeLocalPublicAssetPath(trimmed)) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    const configuredOrigin = getConfiguredSupabaseOrigin();
    const isConfiguredSupabase = Boolean(configuredOrigin && url.origin === configuredOrigin);
    const isHostedSupabase = url.protocol === "https:" && url.hostname.toLowerCase().endsWith(".supabase.co");
    const objectPath = getStorageObjectPathFromPublicUrl(trimmed);
    const extension = extensionFromPathname(objectPath || "");

    return (
      (isConfiguredSupabase || isHostedSupabase) &&
      Boolean(objectPath) &&
      ALLOWED_PRODUCT_MEDIA_PREFIXES.some((prefix) => objectPath!.startsWith(prefix)) &&
      ALLOWED_PUBLIC_ASSET_EXTENSIONS.has(extension)
    );
  } catch {
    return false;
  }
}

export function isAllowedBrandingAssetUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed === "/favicon.ico") {
    return true;
  }

  if (isSafeLocalPublicAssetPath(trimmed)) {
    return true;
  }

  const objectPath = getStorageObjectPathFromPublicUrl(trimmed);

  return Boolean(objectPath && objectPath.startsWith("branding/") && isAllowedProductMediaUrl(trimmed));
}
