import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseService,
  hasSupabaseConfig,
} from '@/lib/supabase/server';
import {
  getSyncClient,
  readUserTrades,
  syncUserFromIndexer,
} from '@/lib/supabase/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(req: NextRequest) {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'supabase not configured' },
      { status: 503 },
    );
  }

  const address = req.nextUrl.searchParams.get('address');
  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const sb = getSupabaseService();
  const client = getSyncClient();

  // Idempotent upsert from indexer; safe to run on every request.
  // Failure here doesn't block the read — we still return whatever's in
  // the DB so the page renders something useful when the indexer is down.
  let synced: { tradesUpserted: number; settlementsUpserted: number } | null = null;
  let syncError: string | null = null;
  try {
    synced = await syncUserFromIndexer(sb, client, address);
  } catch (e) {
    syncError = (e as Error).message;
  }

  let rows;
  try {
    rows = await readUserTrades(sb, address);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    rows,
    synced,
    syncError,
  });
}
