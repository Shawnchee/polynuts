import { NextResponse, type NextRequest } from 'next/server';

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

// Hard ceiling on tracked keys. Under a flood of DISTINCT keys within one
// window nothing expires, so pruning alone frees nothing and the Map would grow
// without bound (with every insert then paying an O(n) prune). We must be able
// to evict live windows too.
const MAX_KEYS = 10_000;

/**
 * Fixed-window counter. Returns whether this hit is allowed and, if not, how
 * long until the window resets. Expired windows are reset lazily on access;
 * when the Map reaches MAX_KEYS we drop expired entries and, if that frees
 * nothing (a distinct-key flood), hard-evict the oldest-inserted keys so the
 * Map can't grow unbounded.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    if (store.size >= MAX_KEYS) {
      pruneExpired(now);
      // Still full → live, distinct windows. Evict the oldest ~10% (insertion
      // order). Evicting a live window just resets that key's counter, which is
      // acceptable degradation under an active flood.
      if (store.size >= MAX_KEYS) evictOldest(Math.ceil(MAX_KEYS / 10));
    }
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

function evictOldest(n: number): void {
  let removed = 0;
  for (const k of store.keys()) {
    if (removed >= n) break;
    store.delete(k);
    removed += 1;
  }
}

/**
 * Best-effort client IP. Prefer `x-real-ip`: on Vercel the platform sets it to
 * the true connecting IP and overwrites any client-supplied value, so it can't
 * be spoofed to rotate past the per-IP limit — unlike the leftmost
 * `x-forwarded-for` token, which a client can prepend. Falls back to the first
 * `x-forwarded-for` entry off-Vercel, then a shared bucket (local dev, tests).
 * `NextRequest.ip` was removed in Next 16, so we read headers directly.
 */
export function clientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return 'local';
}

/**
 * Route-handler convenience: enforce a per-IP limit on `bucket` and return a
 * ready-to-send 429 (with `Retry-After`) when it's exceeded, or `null` to let
 * the handler proceed. Mirrors the inline guard in /api/me/trades so the public
 * write routes (/api/waitlist, /api/feedback) share one implementation.
 */
export function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const { allowed, retryAfterMs } = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (allowed) return null;
  return NextResponse.json(
    { error: 'rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

/** Test-only: clear all limiter state for deterministic assertions. */
export function resetRateLimit(): void {
  store.clear();
}

/** Test-only: number of keys currently tracked (for the size-bound test). */
export function rateLimitSize(): number {
  return store.size;
}
