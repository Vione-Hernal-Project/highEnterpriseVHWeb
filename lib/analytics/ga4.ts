import "server-only";

import { createSign } from "node:crypto";

type Ga4Metric = {
  name: string;
};

type Ga4Dimension = {
  name: string;
};

type Ga4ReportRequest = {
  dateRanges?: Array<{
    startDate: string;
    endDate: string;
  }>;
  dimensions?: Ga4Dimension[];
  metrics: Ga4Metric[];
  dimensionFilter?: Record<string, unknown>;
  limit?: string;
  orderBys?: Array<Record<string, unknown>>;
};

type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4ReportResponse = {
  rows?: Ga4ReportRow[];
  totals?: Ga4ReportRow[];
};

type GoogleServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

export type Ga4PageViewsResult = {
  connected: boolean;
  totalViews: number | null;
  viewsByPath: Record<string, number>;
};

export type Ga4VisitorSummary = {
  connected: boolean;
  activeUsers: number | null;
  totalUsers: number | null;
  sessions: number | null;
};

export type Ga4DateRange = {
  startDate: string;
  endDate: string;
};

export type Ga4TrafficSource = {
  channel: string;
  activeUsers: number;
  sessions: number;
};

export type Ga4DailyTrafficPoint = {
  date: string;
  activeUsers: number;
  sessions: number;
};

export type Ga4TrafficOverview = Ga4VisitorSummary & {
  sourceBreakdown: Ga4TrafficSource[];
  daily: Ga4DailyTrafficPoint[];
};

export type Ga4BannerSummary = {
  connected: boolean;
  impressions: number | null;
  clicks: number | null;
};

export type Ga4CampaignSummary = {
  connected: boolean;
  campaignSessions: number | null;
  totalSessions: number | null;
  campaignTrafficRate: number | null;
};

const GA4_DEFAULT_DATE_RANGE = {
  startDate: "30daysAgo",
  endDate: "today",
};
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA4_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GA4_EVENT_NAMES = {
  bannerImpression: "vh_banner_impression",
  bannerClick: "vh_banner_click",
};

let cachedAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function parseServiceAccountCredentials() {
  const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();

  if (!rawCredentials) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCredentials) as GoogleServiceAccountCredentials;
    const clientEmail = parsed.client_email?.trim();
    const privateKey = parsed.private_key?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      return null;
    }

    return {
      clientEmail,
      privateKey,
      tokenUri: parsed.token_uri?.trim() || GA4_TOKEN_AUDIENCE,
    };
  } catch {
    return null;
  }
}

function getGa4PropertyId() {
  return process.env.GA4_PROPERTY_ID?.trim() || "";
}

function isGa4Configured() {
  return Boolean(getGa4PropertyId() && parseServiceAccountCredentials());
}

function parseMetricValue(row: Ga4ReportRow | undefined, index: number) {
  const numeric = Number(row?.metricValues?.[index]?.value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeGa4Date(value: string) {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  return value;
}

function normalizePath(value: string) {
  if (!value || value === "/") {
    return "/";
  }

  return `/${value.replace(/^\/+/, "").replace(/\/+$/g, "")}`;
}

function getPathVariants(paths: string[]) {
  return [...new Set(paths.flatMap((path) => {
    const normalizedPath = normalizePath(path);

    if (normalizedPath === "/") {
      return ["/"];
    }

    return [normalizedPath, `${normalizedPath}/`];
  }))];
}

function findOriginalPath(path: string, originalPaths: string[]) {
  const normalizedPath = normalizePath(path);
  return originalPaths.find((originalPath) => normalizePath(originalPath) === normalizedPath) || normalizedPath;
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const credentials = parseServiceAccountCredentials();

  if (!credentials) {
    return null;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: GA4_SCOPE,
    aud: credentials.tokenUri,
    iat: issuedAt,
    exp: expiresAt,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(credentials.privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const response = await fetch(credentials.tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payloadJson = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;

  if (!payloadJson?.access_token) {
    return null;
  }

  cachedAccessToken = {
    token: payloadJson.access_token,
    expiresAt: Date.now() + Math.max(1, payloadJson.expires_in || 3600) * 1000,
  };

  return cachedAccessToken.token;
}

async function runGa4Report(request: Ga4ReportRequest) {
  const propertyId = getGa4PropertyId();

  if (!isGa4Configured()) {
    return null;
  }

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return null;
    }

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [GA4_DEFAULT_DATE_RANGE],
        ...request,
      }),
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      console.warn("[GA4] Report request failed.", { status: response.status, propertyId });
      return null;
    }

    return await response.json() as Ga4ReportResponse;
  } catch (error) {
    console.warn("[GA4] Report request failed.", { error: error instanceof Error ? error.message : "Unknown GA4 error" });
    return null;
  }
}

export async function loadGa4PageViews(paths: string[]): Promise<Ga4PageViewsResult> {
  const uniquePaths = [...new Set(paths.map(normalizePath))];

  if (!uniquePaths.length) {
    return {
      connected: isGa4Configured(),
      totalViews: 0,
      viewsByPath: {},
    };
  }

  const pathVariants = getPathVariants(uniquePaths);
  const report = await runGa4Report({
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        inListFilter: {
          values: pathVariants,
        },
      },
    },
    limit: "10000",
  });

  if (!report) {
    return {
      connected: false,
      totalViews: null,
      viewsByPath: Object.fromEntries(uniquePaths.map((path) => [path, 0])),
    };
  }

  const viewsByPath = Object.fromEntries(uniquePaths.map((path) => [path, 0]));

  for (const row of report.rows || []) {
    const gaPath = row.dimensionValues?.[0]?.value || "";
    const originalPath = findOriginalPath(gaPath, uniquePaths);
    viewsByPath[originalPath] = (viewsByPath[originalPath] || 0) + parseMetricValue(row, 0);
  }

  return {
    connected: true,
    totalViews: Object.values(viewsByPath).reduce((total, views) => total + views, 0),
    viewsByPath,
  };
}

export async function loadGa4VisitorSummary(): Promise<Ga4VisitorSummary> {
  const report = await runGa4Report({
    metrics: [{ name: "activeUsers" }, { name: "totalUsers" }, { name: "sessions" }],
  });

  if (!report) {
    return {
      connected: false,
      activeUsers: null,
      totalUsers: null,
      sessions: null,
    };
  }

  const totalRow = report.totals?.[0] || report.rows?.[0];

  return {
    connected: true,
    activeUsers: parseMetricValue(totalRow, 0),
    totalUsers: parseMetricValue(totalRow, 1),
    sessions: parseMetricValue(totalRow, 2),
  };
}

export async function loadGa4TrafficOverview(dateRange: Ga4DateRange): Promise<Ga4TrafficOverview> {
  const [summaryReport, sourceReport, dailyReport] = await Promise.all([
    runGa4Report({
      dateRanges: [dateRange],
      metrics: [{ name: "activeUsers" }, { name: "totalUsers" }, { name: "sessions" }],
    }),
    runGa4Report({
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      limit: "20",
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runGa4Report({
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      limit: "366",
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
  ]);

  if (!summaryReport && !sourceReport && !dailyReport) {
    return {
      connected: false,
      activeUsers: null,
      totalUsers: null,
      sessions: null,
      sourceBreakdown: [],
      daily: [],
    };
  }

  const totalRow = summaryReport?.totals?.[0] || summaryReport?.rows?.[0];

  return {
    connected: true,
    activeUsers: summaryReport ? parseMetricValue(totalRow, 0) : null,
    totalUsers: summaryReport ? parseMetricValue(totalRow, 1) : null,
    sessions: summaryReport ? parseMetricValue(totalRow, 2) : null,
    sourceBreakdown: (sourceReport?.rows || []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value || "Other",
      activeUsers: parseMetricValue(row, 0),
      sessions: parseMetricValue(row, 1),
    })),
    daily: (dailyReport?.rows || []).map((row) => ({
      date: normalizeGa4Date(row.dimensionValues?.[0]?.value || ""),
      activeUsers: parseMetricValue(row, 0),
      sessions: parseMetricValue(row, 1),
    })),
  };
}

export async function loadGa4BannerSummary(): Promise<Ga4BannerSummary> {
  const report = await runGa4Report({
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: [GA4_EVENT_NAMES.bannerImpression, GA4_EVENT_NAMES.bannerClick],
        },
      },
    },
    limit: "10",
  });

  if (!report) {
    return {
      connected: false,
      impressions: null,
      clicks: null,
    };
  }

  const eventCounts = new Map<string, number>();

  for (const row of report.rows || []) {
    eventCounts.set(row.dimensionValues?.[0]?.value || "", parseMetricValue(row, 0));
  }

  return {
    connected: true,
    impressions: eventCounts.get(GA4_EVENT_NAMES.bannerImpression) || 0,
    clicks: eventCounts.get(GA4_EVENT_NAMES.bannerClick) || 0,
  };
}

export async function loadGa4CampaignSummary(totalSessionsFallback?: number | null): Promise<Ga4CampaignSummary> {
  const report = await runGa4Report({
    dimensions: [{ name: "sessionCampaignName" }],
    metrics: [{ name: "sessions" }],
    limit: "1000",
  });

  if (!report) {
    return {
      connected: false,
      campaignSessions: null,
      totalSessions: totalSessionsFallback ?? null,
      campaignTrafficRate: null,
    };
  }

  let campaignSessions = 0;
  let totalSessions = 0;

  for (const row of report.rows || []) {
    const campaignName = (row.dimensionValues?.[0]?.value || "").trim().toLowerCase();
    const sessions = parseMetricValue(row, 0);
    totalSessions += sessions;

    if (campaignName && campaignName !== "(not set)" && campaignName !== "(direct)") {
      campaignSessions += sessions;
    }
  }

  const resolvedTotalSessions = totalSessions || totalSessionsFallback || 0;

  return {
    connected: true,
    campaignSessions,
    totalSessions: resolvedTotalSessions,
    campaignTrafficRate: resolvedTotalSessions ? (campaignSessions / resolvedTotalSessions) * 100 : 0,
  };
}
