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
  deriveBrokerFeeUsdc,
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

// market_label is the one free-text field a client controls, and it ships in the
// public recent-trades JSON to every leaderboard visitor. A verified fill can be
// re-POSTed with a huge or control-char-laden label, so bound the length and
// strip C0/DEL/C1 control characters (incl. newlines) before persisting — payload
// bloat / content-abuse defence. (Rendering is a React text node, so not XSS.)
const MARKET_LABEL_MAX = 80;
function sanitizeMarketLabel(raw: unknown): string {
  return String(raw)
    .slice(0, MARKET_LABEL_MAX)
    // Strip C0 controls + DEL + C1 controls (includes newlines/tabs).
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
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

  // Read the user's trades first — a cheap DB SELECT that doubles as an
  // existence check. Entries only ever come from POST (write-on-fill), so an
  // arbitrary ?address= with no rows must NOT be able to trigger the paid
  // settlement sync (RPC + indexer) below — otherwise anyone could amplify our
  // upstream cost against any wallet. syncSettlementsOnly never inserts new
  // rows, so gating on existence can't hide a legit user's trades.
  let rows;
  try {
    rows = await readUserTrades(sb, address);
  } catch (e) {
    console.error('[me/trades] readUserTrades failed', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  // Check the indexer ONLY for settlements on trades already in our DB, and only
  // when the address actually has some. Re-read afterwards so any freshly-written
  // settlements appear in this same response (skip the extra read when nothing
  // changed).
  let synced: { settlementsUpserted: number } | null = null;
  let syncError: string | null = null;
  if (rows.length > 0) {
    try {
      synced = await syncSettlementsOnly(sb, getSyncClient(), address);
      if (synced.settlementsUpserted > 0) {
        rows = await readUserTrades(sb, address);
      }
    } catch (e) {
      syncError = (e as Error).message;
    }
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

  // Store the broker fee the taker paid on top of premium, re-derived SERVER-SIDE
  // from the verified premium × the broker's immutable feeBps — never the
  // client's claimed fee. This is what lets realized PnL / is_win net the fee so
  // a payout between premium and premium+fee reads as the net LOSS it is. A read
  // failure stores null (treated as 0 downstream) rather than dropping a fill
  // that is already confirmed on-chain.
  let feeUsdc: number | null = null;
  try {
    feeUsdc = await deriveBrokerFeeUsdc(client, onChainPremium);
  } catch (e) {
    console.warn('[me/trades] broker fee derivation failed; storing null', e);
  }

  const payload: FillPayload = {
    tx_hash: data.tx_hash!,
    option_id: data.option_id!,
    taker_address: data.taker_address!,
    market_label: sanitizeMarketLabel(data.market_label),
    side: data.side!,
    contracts: data.contracts!,
    notional_usdc: onChainPremium,
    entry_price:
      data.contracts! > 0 ? onChainPremium / data.contracts! : data.entry_price!,
    fee_usdc: feeUsdc,
    created_at: new Date().toISOString(),
  };

  const sb = getSupabaseService();
  try {
    await writeFillToDb(sb, payload);
  } catch (e) {
    console.error('[me/trades] writeFillToDb failed', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
