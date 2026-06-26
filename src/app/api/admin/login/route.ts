import { NextResponse, type NextRequest } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_TTL_MS,
  checkAdminPassword,
  isAdminConfigured,
  signAdminToken,
} from '@/lib/admin/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin login. On a correct password, set the signed session cookie that
// /admin and /api/admin/* check. Rate-limited to blunt password guessing from a
// single IP (the limiter is per-instance; see src/lib/rate-limit.ts).
const LIMIT = 8;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'admin-login', LIMIT, WINDOW_MS);
  if (limited) return limited;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'admin not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const password = (body as Record<string, unknown>)?.password;
  if (typeof password !== 'string' || !checkAdminPassword(password)) {
    // Same generic message + status whether the field was missing or wrong, so
    // a probe can't distinguish "no password sent" from "wrong password".
    return NextResponse.json({ error: 'invalid password' }, { status: 401 });
  }

  const token = signAdminToken();
  if (!token) {
    return NextResponse.json({ error: 'admin not configured' }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
  return res;
}
