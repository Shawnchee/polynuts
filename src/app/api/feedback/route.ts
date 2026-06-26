import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseService, hasSupabaseConfig } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side feedback submission. Inserts with SUPABASE_SERVICE_ROLE_KEY
// (bypasses RLS), so once migration 0005 drops the public anon INSERT policy
// this is the ONLY write path into public.feedback — the public anon key can no
// longer spam rows straight into PostgREST. Reads were never possible (no
// SELECT policy); the owner reads submissions in the Supabase dashboard.
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ALLOWED_CATEGORIES = new Set(['bug', 'idea', 'other']);

const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'feedback', LIMIT, WINDOW_MS);
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

  // The DB CHECK enforces 1..2000 chars; mirror it here so junk is rejected
  // before the round-trip and the 2000-char ceiling can't be exceeded.
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: 'invalid message' }, { status: 400 });
  }

  // Category is optional; '' (General) and anything off the known list → null.
  const category =
    typeof data.category === 'string' && ALLOWED_CATEGORIES.has(data.category)
      ? data.category
      : null;
  const email =
    typeof data.email === 'string' && data.email.trim() !== ''
      ? data.email.trim().slice(0, 320)
      : null;
  const wallet =
    typeof data.wallet_address === 'string' && ADDRESS_RE.test(data.wallet_address)
      ? data.wallet_address
      : null;
  const pagePath = typeof data.page_path === 'string' ? data.page_path.slice(0, 300) : null;
  // UA from the request header, not the client body.
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null;

  const sb = getSupabaseService();
  const { error } = await sb.from('feedback').insert({
    message,
    category,
    email,
    wallet_address: wallet,
    page_path: pagePath,
    user_agent: userAgent,
  });
  if (error) {
    return NextResponse.json({ error: 'could not send feedback' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
