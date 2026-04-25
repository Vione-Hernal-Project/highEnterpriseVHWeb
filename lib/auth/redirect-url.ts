export function resolveAuthRedirectUrl(params: {
  configuredSiteUrl: string;
  requestUrl: URL;
  path: string;
}) {
  const configuredSiteUrl = params.configuredSiteUrl.trim();
  const requestUrl = params.requestUrl;

  if (configuredSiteUrl) {
    try {
      const siteUrl = new URL(configuredSiteUrl);
      const normalizedConfiguredHost = normalizeComparableHost(siteUrl.hostname);
      const normalizedRequestHost = normalizeComparableHost(requestUrl.hostname);

      if (
        process.env.NODE_ENV === "production" &&
        (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1")
      ) {
        return new URL(params.path, requestUrl.origin).toString();
      }

      // When the live site can be reached on both apex and www, keep the
      // redirect on the host the visitor is already using as long as it is
      // clearly the same production domain family.
      if (
        normalizedConfiguredHost &&
        normalizedRequestHost &&
        normalizedConfiguredHost === normalizedRequestHost &&
        requestUrl.protocol === "https:"
      ) {
        return new URL(params.path, requestUrl.origin).toString();
      }

      return new URL(params.path, siteUrl).toString();
    } catch {
      // Fall back to the current request origin when the configured site URL is invalid.
    }
  }

  return new URL(params.path, requestUrl.origin).toString();
}

function normalizeComparableHost(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}
