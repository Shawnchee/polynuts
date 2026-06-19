import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { type OrderFillEvent } from '@thetanuts-finance/thetanuts-client';
import { getSupabaseService } from '@/lib/supabase/server';
import { getSyncClient, writeFillToDb, syncSettlementsOnly, type FillPayload } from '@/lib/supabase/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cron route for the leaderboard — runs every 30 minutes via Vercel Cron.
// Two jobs in one pass:
//   1. Recover fills from the last ~3 000 blocks that went through our referrer
//      address (handles the case where the UI's write-on-fill missed a trade).
//   2. Settle open trades for every known trader.
//
// Both GET and POST require Authorization: Bearer <CRON_SECRET>.
// Vercel Cron automatically sends this header when CRON_SECRET is set in
// project env vars — no extra config needed.

async function runSync(sb: SupabaseClient, client: ThetanutsClient) {
  const errors: Array<{ context: string; message: string }> = [];

  // 1. Get current block number.
  const currentBlock: number = await client.provider.getBlockNumber();

  // 2. Fetch fills for the last ~3 000 blocks.
  const fills: OrderFillEvent[] = await client.events.getOrderFillEvents({
    fromBlock: Math.max(0, currentBlock - 3000),
  });

  // 3. Filter to fills that went through our referrer address.
  const referrerAddress = process.env.NEXT_PUBLIC_REFERRER_ADDRESS ?? '';
  const ourFills = fills.filter(
    (f) => f.referrer.toLowerCase() === referrerAddress.toLowerCase(),
  );

  // 4. Write each of our fills to DB (recovery path).
  for (const fill of ourFills) {
    // We only have the OrderFilled event here, whose `price` is the on-chain
    // mmPrice (probability-like, ~0.005) — NOT the premium the taker paid.
    // Synthesizing notional/entry from it produced a wildly understated cost
    // basis that fed the Cost column and inflated displayed PnL. Record the
    // trade so settlement can attach, but leave cost/side/entry unknown: the
    // UI renders 0/null cost as "—", and a settlement's realized PnL comes from
    // the indexer's authoritative `pnlUsd` (not payout − cost), so the missing
    // basis doesn't corrupt any settled number.
    const payload: FillPayload = {
      tx_hash: fill.transactionHash,
      option_id: fill.option.toLowerCase(),
      taker_address: fill.taker.toLowerCase(),
      market_label: 'recovered',
      side: null,
      contracts: Number(fill.numContracts) / 1e6,
      notional_usdc: 0,
      entry_price: null,
      created_at: new Date().toISOString(),
    };
    try {
      await writeFillToDb(sb, payload);
    } catch (e) {
      errors.push({
        context: `writeFillToDb:${fill.transactionHash}`,
        message: (e as Error).message,
      });
    }
  }

  // 5. Get all known traders.
  const { data: traders } = await sb.from('traders').select('address');

  // 6. Sync settlements for each trader.
  let settlementsUpserted = 0;
  for (const trader of traders ?? []) {
    try {
      const r = await syncSettlementsOnly(sb, client, (trader as { address: string }).address);
      settlementsUpserted += r.settlementsUpserted;
    } catch (e) {
      errors.push({
        context: `syncSettlementsOnly:${(trader as { address: string }).address}`,
        message: (e as Error).message,
      });
    }
  }

  return {
    ok: true,
    recoveredFills: ourFills.length,
    tradersScanned: traders?.length ?? 0,
    settlementsUpserted,
    errors,
  };
}

function checkPostAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = Buffer.from(auth);
  const want = Buffer.from(`Bearer ${expected}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!checkPostAuth(req)) {
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
  const result = await runSync(sb, client);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!checkPostAuth(req)) {
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
  const result = await runSync(sb, client);
  return NextResponse.json(result);
}
