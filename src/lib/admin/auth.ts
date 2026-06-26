import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ─── Admin session gate ──────────────────────────────────────────────────────
// The /admin dashboard reads write-only tables (waitlist, feedback) with the
// service-role key, so it MUST run server-side and be locked down. There's no
// user-auth system in the app, so we gate on a single shared password
// (ADMIN_PASSWORD) the way the cron route gates on CRON_SECRET.
//
// Login (POST /api/admin/login) compares the submitted password to
// ADMIN_PASSWORD (timing-safe) and, on success, sets an httpOnly cookie holding
// a signed, expiring token. The raw password is NEVER stored in the cookie —
// the token is `exp.HMAC(exp)` keyed by the password itself, so a stolen cookie
// can't be replayed past `exp` and tampering with `exp` breaks the signature.

export const ADMIN_COOKIE = 'pn_admin';

/** Session lifetime. A re-login is cheap; keep it short-ish for an admin tool. */
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function secret(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : null;
}

/** Whether an admin password is configured at all. */
export function isAdminConfigured(): boolean {
  return secret() !== null;
}

/** Constant-time compare of two strings (length-independent, no early-out). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; hash both to a fixed width first
  // so the comparison itself doesn't leak length.
  const ah = createHmac('sha256', 'len').update(ab).digest();
  const bh = createHmac('sha256', 'len').update(bb).digest();
  return timingSafeEqual(ah, bh);
}

/** Verify a submitted password against ADMIN_PASSWORD. False if unconfigured. */
export function checkAdminPassword(submitted: string): boolean {
  const s = secret();
  if (s === null) return false;
  return safeEqual(submitted, s);
}

function sign(exp: number, key: string): string {
  return createHmac('sha256', key).update(String(exp)).digest('hex');
}

/** Mint a signed session token valid until `now + ADMIN_TTL_MS`. */
export function signAdminToken(now: number = Date.now()): string | null {
  const key = secret();
  if (key === null) return null;
  const exp = now + ADMIN_TTL_MS;
  return `${exp}.${sign(exp, key)}`;
}

/**
 * Verify a session token: signature must match the current password and the
 * expiry must be in the future. Returns false for any malformed/expired/forged
 * token, or when no password is configured.
 */
export function verifyAdminToken(token: string | undefined | null, now: number = Date.now()): boolean {
  const key = secret();
  if (key === null || !token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = sign(exp, key);
  // Equal length (hex of sha256 = 64 chars) lets us compare directly.
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
