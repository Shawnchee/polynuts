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
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Numeric payload fields must be real, non-negative numbers. A bare
// `typeof x === 'number'` admits NaN/Infinity (which bounce off NOT NULL
// columns as a 500) and negatives (which would persist and skew volume / PnL /
// ROI). Note the economic fields are re-derived from the on-chain premium
// below regardless — this just rejects obviously-bad input early.
function isFiniteNonNeg(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0;
}

// Both handlers fan out to a paid RPC / indexer, so cap per-IP request rate.
// GET (read + settlement sync) is polled by the portfolio page; POST (write +
// on-chain verification, the costlier path) fires once per placed bet.
const GET_LIMIT = 60;
const POST_LIMIT = 20;
const WINDOW_MS = 60_000;

function tooMany(req: NextRequest, bucket: string, limit: number): NextResponse | null {
  const { allowed, retryAfterMs } = rateLimit(`${bucket}:${clientIp(req)}`, limit, WINDOW_MS);
  if (allowed) return null;
  return NextResponse.json(
    { error: 'rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

// ─── GET: read this user's trades from Supabase, settle any open ones ────────
export async function GET(req: NextRequest) {
  const limited = tooMany(req, 'GET', GET_LIMIT);
  if (limited) return limited;

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
  const limited = tooMany(req, 'POST', POST_LIMIT);
  if (limited) return limited;

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
    !isFiniteNonNeg(data.contracts) ||
    !isFiniteNonNeg(data.notional_usdc) ||
    !isFiniteNonNeg(data.entry_price)
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

  // Build the row from an explicit allowlist — never spread the raw body (that
  // would let a client set arbitrary `trades` columns, e.g. force a row id).
  // The economic fields come from the VERIFIED on-chain premium, not the
  // client's claim: `notional_usdc` is the real USDC premium from the
  // OrderFilled event and `entry_price` is re-derived from it, so a real fill
  // can't be re-POSTed with an inflated amount to fake leaderboard volume or
  // portfolio ROI. `created_at` is server-stamped (never trust the client's).
  const onChainPremium = verification.premiumUsdc;
  const payload: FillPayload = {
    tx_hash: data.tx_hash!,
    option_id: data.option_id!,
    taker_address: data.taker_address!,
    market_label: data.market_label!,
    side: data.side!,
    contracts: data.contracts!,
    notional_usdc: onChainPremium,
    entry_price:
      data.contracts! > 0 ? onChainPremium / data.contracts! : data.entry_price!,
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
