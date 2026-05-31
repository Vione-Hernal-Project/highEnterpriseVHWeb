const LOCAL_PUBLIC_ASSET_PATH_PATTERN = /^\/(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w./~@%+-]+$/;

export function isSafeLocalPublicAssetPath(value: string | null | undefined) {
  const trimmedValue = (value || "").trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedValue, "https://local.invalid");

    if (parsedUrl.origin !== "https://local.invalid") {
      return false;
    }

    if (parsedUrl.pathname !== trimmedValue && trimmedValue.includes(":")) {
      return false;
    }

    return LOCAL_PUBLIC_ASSET_PATH_PATTERN.test(decodeURIComponent(parsedUrl.pathname));
  } catch {
    return false;
  }
}
