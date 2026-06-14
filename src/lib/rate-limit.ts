import type { NextRequest } from 'next/server';

// ─── Lightweight in-memory rate limiter ─────────────────────────────────────
// A dependency-free sliding-window limiter keyed by client IP. It exists to
// blunt the cost/DoS amplification on public routes that fan out to a paid RPC
// / indexer (e.g. /api/me/trades): without it, anyone can spam the endpoint and
// burn quota even though the request itself returns nothing useful.
//
// LIMITATION — this is per-instance. Vercel runs many serverless instances, so
// the window is enforced per warm instance, not globally. That is enough to
// stop a single client hammering one instance, but a distributed flood can
// still spread across instances. For a hard global limit, swap the Map below
// for @upstash/ratelimit backed by Upstash Redis (set UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN) — the call sites here don't need to change.

interface Hit {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

const store = new Map<string, Hit>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Fixed-window counter. Returns whether this hit is allowed and, if not, how
 * long until the window resets. Expired windows are reset lazily on access; a
 * size cap prunes the oldest keys so the Map can't grow unbounded under a flood
 * of distinct IPs.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    if (store.size > 10_000) pruneExpired(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

function pruneExpired(now: number): void {
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}

/**
 * Best-effort client IP. On Vercel the real client IP is the first entry of
 * `x-forwarded-for`. `NextRequest.ip` was removed in Next 16, so we read headers
 * directly. Falls back to a shared bucket when no IP header is present (local
 * dev, tests) — fine, since those aren't the abuse target.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

/** Test-only: clear all limiter state for deterministic assertions. */
export function resetRateLimit(): void {
  store.clear();
}
