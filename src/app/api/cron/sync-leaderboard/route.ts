import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseService } from '@/lib/supabase/server';
import { getSyncClient, syncUserFromIndexer } from '@/lib/supabase/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional — sync-on-visit (POST /api/me/trades) is the primary writer
// now. This cron exists for the leaderboard cold-start case where you
// want to keep inactive wallets' settlements current. Configure Vercel
// Cron (or Supabase pg_cron) to POST here every N minutes with
// `Authorization: Bearer ${CRON_SECRET}`.
//
// If you don't need cross-user leaderboards covering inactive wallets,
// this route can be safely deleted. The shared sync logic lives in
// `src/lib/supabase/sync.ts`.

export async function GET() {
  return NextResponse.json(
    { error: 'method not allowed — POST with Authorization: Bearer <CRON_SECRET>' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const got = Buffer.from(auth);
  const want = Buffer.from(`Bearer ${expected}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });
  }

  const sb = getSupabaseService();
  const client = getSyncClient();

  const { data: existing, error: existingErr } = await sb
    .from('traders')
    .select('address');
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  const addresses = ((existing ?? []) as Array<{ address: string }>).map((r) => r.address);

  let tradesUpserted = 0;
  let settlementsUpserted = 0;
  const errors: Array<{ address: string; message: string }> = [];

  for (const addr of addresses) {
    try {
      const r = await syncUserFromIndexer(sb, client, addr);
      tradesUpserted += r.tradesUpserted;
      settlementsUpserted += r.settlementsUpserted;
    } catch (e) {
      errors.push({ address: addr, message: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    addresses: addresses.length,
    tradesUpserted,
    settlementsUpserted,
    errors,
  });
}
