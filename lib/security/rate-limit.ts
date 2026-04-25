import "server-only";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;
type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: "memory" | "upstash";
};

declare global {
  var __vioneRateLimitStore: RateLimitStore | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__vioneRateLimitStore) {
    globalThis.__vioneRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return globalThis.__vioneRateLimitStore;
}

function compactExpiredEntries(store: RateLimitStore, now: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

async function runUpstashPipeline(commands: string[][]) {
  const config = getUpstashConfig();

  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit request failed with status ${response.status}.`);
  }

  return (await response.json()) as Array<{ result?: unknown; error?: string }>;
}

async function applyUpstashRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  if (!getUpstashConfig()) {
    return null;
  }

  const now = Date.now();
  const payload = await runUpstashPipeline([
    ["INCR", params.key],
    ["PEXPIRE", params.key, String(params.windowMs), "NX"],
    ["PTTL", params.key],
  ]);

  if (!payload) {
    return null;
  }

  if (payload.some((item) => item?.error)) {
    throw new Error(payload.find((item) => item?.error)?.error || "Upstash rate limit pipeline failed.");
  }

  const count = Number(payload[0]?.result ?? 0);
  const ttlMs = Number(payload[2]?.result ?? params.windowMs);
  const effectiveTtlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : params.windowMs;

  return {
    allowed: count <= params.limit,
    remaining: Math.max(0, params.limit - count),
    resetAt: now + effectiveTtlMs,
    source: "upstash",
  };
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const candidate = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (candidate) {
      return candidate;
    }
  }

  const directIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");

  return directIp?.trim() || "unknown";
}

function applyMemoryRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();

  compactExpiredEntries(store, now);

  const current = store.get(params.key);

  if (!current || current.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + params.windowMs,
    };

    store.set(params.key, nextEntry);

    return {
      allowed: true,
      remaining: Math.max(0, params.limit - nextEntry.count),
      resetAt: nextEntry.resetAt,
      source: "memory",
    };
  }

  current.count += 1;
  store.set(params.key, current);

  return {
    allowed: current.count <= params.limit,
    remaining: Math.max(0, params.limit - current.count),
    resetAt: current.resetAt,
    source: "memory",
  };
}

export async function applyRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  try {
    return (await applyUpstashRateLimit(params)) ?? applyMemoryRateLimit(params);
  } catch {
    return applyMemoryRateLimit(params);
  }
}

export async function clearRateLimit(key: string) {
  try {
    const payload = await runUpstashPipeline([["DEL", key]]);

    if (payload && !payload.some((item) => item?.error)) {
      return;
    }
  } catch {
    // Fall back to the in-memory limiter when the shared store is unavailable.
  }

  getRateLimitStore().delete(key);
}

export function buildRateLimitHeaders(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    "Retry-After": String(retryAfterSeconds),
  };
}
