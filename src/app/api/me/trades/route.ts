import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseService,
  hasSupabaseConfig,
} from '@/lib/supabase/server';
import {
  getSyncClient,
  syncSettlementsOnly,
  writeFillToDb,
  readUserTrades,
  verifyFillOnChain,
  type FillPayload,
} from '@/lib/supabase/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// ─── GET: read this user's trades from Supabase, settle any open ones ────────
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

  // Check the indexer ONLY for settlements on trades already in our DB.
  // Never adds new trade rows — entries come exclusively from POST (write-on-fill).
  let synced: { settlementsUpserted: number } | null = null;
  let syncError: string | null = null;
  try {
    synced = await syncSettlementsOnly(sb, client, address);
  } catch (e) {
    syncError = (e as Error).message;
  }

  let rows;
  try {
    rows = await readUserTrades(sb, address);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ rows, synced, syncError });
}

// ─── POST: write a single fill to Supabase immediately after fillOrder ───────
// Called client-side right after the tx confirms. This is the only way trades
// enter the DB — ensuring the leaderboard and activity only show Polynuts trades.
export async function POST(req: NextRequest) {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'supabase not configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const data = body as Partial<FillPayload>;

  if (
    typeof data.tx_hash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(data.tx_hash) ||
    typeof data.option_id !== 'string' ||
    !ADDRESS_RE.test(data.option_id) ||
    typeof data.taker_address !== 'string' ||
    !ADDRESS_RE.test(data.taker_address) ||
    typeof data.market_label !== 'string' ||
    typeof data.side !== 'string' ||
    !['PUMP', 'DUMP', 'RANGE'].includes(data.side) ||
    typeof data.contracts !== 'number' ||
    typeof data.notional_usdc !== 'number' ||
    typeof data.entry_price !== 'number'
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  // Verify the tx is real on-chain and the sender matches the claimed taker.
  // This prevents anyone from writing fake trade records for wallets they don't control.
  const client = getSyncClient();
  const verification = await verifyFillOnChain(
    client,
    data.tx_hash!,
    data.taker_address!,
    data.option_id!,
  ).catch((e: unknown) => ({ ok: false as const, reason: (e as Error).message }));

  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 403 });
  }

  // Always stamp the server time — never trust the client-supplied created_at.
  const payload: FillPayload = {
    ...(data as Omit<FillPayload, 'created_at'>),
    created_at: new Date().toISOString(),
  };

  const sb = getSupabaseService();
  try {
    await writeFillToDb(sb, payload);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
