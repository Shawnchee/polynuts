import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseService, hasSupabaseConfig } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side waitlist signup. Inserts with SUPABASE_SERVICE_ROLE_KEY (bypasses
// RLS), so once migration 0005 drops the public anon INSERT policy this is the
// ONLY write path into public.waitlist — the public anon key can no longer spam
// rows straight into PostgREST. Reads were never possible (no SELECT policy).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// A human joins once. Generous enough to absorb a fat-fingered double-submit,
// tight enough to blunt scripted spam from a single IP.
const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'waitlist', LIMIT, WINDOW_MS);
  if (limited) return limited;

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  // Honeypot: the browser form drops a filled trap before it ever calls us, so a
  // non-empty value here means something posted directly. Pretend success and
  // write nothing — never signal that the trap was detected.
  if (typeof data.company_website === 'string' && data.company_website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  // Normalize server-side; never trust the client to have lowercased/trimmed.
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email.length < 3 || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  // Wallet is optional, but if one is supplied it must be a real EVM address —
  // reject a malformed value rather than silently dropping it.
  let wallet: string | null = null;
  if (data.wallet_address != null) {
    if (typeof data.wallet_address !== 'string' || !ADDRESS_RE.test(data.wallet_address)) {
      return NextResponse.json({ error: 'invalid wallet address' }, { status: 400 });
    }
    wallet = data.wallet_address;
  }

  const source = typeof data.source === 'string' ? data.source.slice(0, 80) : null;
  const referrer = typeof data.referrer === 'string' ? data.referrer.slice(0, 300) : null;
  // Read the UA from the request, not the body — the client can't be trusted to
  // report its own, and there's no reason to accept an arbitrary string.
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null;

  const sb = getSupabaseService();
  // upsert + ignoreDuplicates → a re-submit silently no-ops (no unique-violation
  // leaks whether the email is already on the list).
  const { error } = await sb.from('waitlist').upsert(
    { email, wallet_address: wallet, source, referrer, user_agent: userAgent },
    { onConflict: 'email', ignoreDuplicates: true },
  );
  if (error) {
    return NextResponse.json({ error: 'could not join waitlist' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
