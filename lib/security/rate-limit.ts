import "server-only";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

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

export function applyRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
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
    };
  }

  current.count += 1;
  store.set(params.key, current);

  return {
    allowed: current.count <= params.limit,
    remaining: Math.max(0, params.limit - current.count),
    resetAt: current.resetAt,
  };
}

export function clearRateLimit(key: string) {
  getRateLimitStore().delete(key);
}

export function buildRateLimitHeaders(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    "Retry-After": String(retryAfterSeconds),
  };
}
