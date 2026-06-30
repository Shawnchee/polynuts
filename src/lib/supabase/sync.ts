import 'server-only';
import {
  ThetanutsClient,
  OPTION_BOOK_ABI,
  type Position,
  type TradeHistory,
} from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tradeKey, prefixTx, normTx } from '@/lib/txKey';

const USDC_DECIMALS = 6;
const PRICE_DECIMALS = 8;
const USD_FIELD_DECIMALS = 8;

export function getSyncClient(): ThetanutsClient {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ThetanutsClient({
    chainId: chainId as 8453,
    provider,
  });
}

const OPTION_BOOK_IFACE = new ethers.Interface(OPTION_BOOK_ABI as ethers.InterfaceAbi);
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// The deployed PartnerFeeBroker, if configured. On a broker-routed fill the
// broker contract — not the taker — is the `buyer` in the OptionBook
// OrderFilled event (it calls fillOrder, then forwards the position to the
// taker), so the sync layer must recognise it as a legitimate buyer. Read from
// env per-call rather than module scope so tests can set it before invoking.
function configuredBrokerAddress(): string | null {
  const b = process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS?.toLowerCase();
  return b && b !== ZERO_ADDR ? b : null;
}

/**
 * Verify that a tx_hash is a real, mined OrderFilled transaction whose buyer
 * matches the claimed taker_address (or the configured partner broker) and
 * option. Used by POST /api/me/trades to prevent anyone from writing fake trade
 * records for wallets they don't control.
 *
 * Verification reads the tx's OWN receipt logs (book-agnostic and reliable —
 * the OrderFilled event is always present in the fill tx). We deliberately do
 * NOT use client.events.getOrderFillEvents here: it scans a single OptionBook
 * contract, so fills routed through a secondary/legacy book (e.g. orders posted
 * on 0x1bDff855…) return no match and every such fill would be rejected — which
 * silently dropped real trades from the leaderboard.
 *
 * Broker path: when NEXT_PUBLIC_PARTNER_BROKER_ADDRESS is set, fills route
 * THROUGH the broker, so `buyer` is the broker. We still require
 * `receipt.from === taker` (the taker signs the tx to the broker), so accepting
 * the broker as buyer can't let anyone claim someone else's fill.
 *
 * OrderFilled event args: (nonce, buyer, seller, optionAddress, ...)
 */
export async function verifyFillOnChain(
  client: ThetanutsClient,
  txHash: string,
  takerAddress: string,
  optionId: string,
): Promise<{ ok: true; premiumUsdc: number } | { ok: false; reason: string }> {
  const receipt = await client.provider.getTransactionReceipt(txHash);
  if (!receipt) return { ok: false, reason: 'transaction not found on chain' };

  const taker = takerAddress.toLowerCase();
  const broker = configuredBrokerAddress();

  // The wallet that sent the transaction must be the claimed taker. This is the
  // real anti-spoofing guard and holds on BOTH paths: the taker signs the fill
  // directly to OptionBook, or signs it to the broker on the partner path.
  if (receipt.from.toLowerCase() !== taker) {
    return { ok: false, reason: 'tx sender does not match taker_address' };
  }

  // Find the OrderFilled log and verify the option address.
  for (const log of receipt.logs) {
    try {
      const parsed = OPTION_BOOK_IFACE.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name !== 'OrderFilled') continue;

      // OrderFilled args: (nonce, buyer, seller, optionAddress, premiumAmount,
      // feeCollected, referrer, referralFeePaid, sellerWasMaker)
      const buyer = (parsed.args[1] as string).toLowerCase();
      const optionAddress = (parsed.args[3] as string).toLowerCase();

      if (optionAddress !== optionId.toLowerCase()) continue;
      // Direct fill → buyer is the taker. Broker fill → buyer is the broker
      // contract (gated by receipt.from === taker above, so still un-spoofable).
      if (buyer !== taker && !(broker && buyer === broker)) {
        return {
          ok: false,
          reason: 'buyer in OrderFilled event does not match taker_address or partner broker',
        };
      }
      // Authoritative premium (cost basis) straight from the verified event —
      // the premium paid into OptionBook in 6-dec USDC. Returned so the write
      // path can store the REAL notional instead of trusting the client-supplied
      // amount, which is otherwise unauthenticated and could be inflated to fake
      // leaderboard volume or portfolio ROI. On the broker path this excludes
      // the broker's feeBps skim (a separate ~0.1% the taker pays on top), so
      // notional == option premium stays consistent across both fill paths.
      const premiumUsdc = bigintToNumber(parsed.args[4] as bigint, USDC_DECIMALS);
      return { ok: true, premiumUsdc };
    } catch { /* skip logs from other contracts */ }
  }

  return { ok: false, reason: 'no matching OrderFilled event for option in transaction' };
}

export function bigintToNumber(value: bigint, decimals: number): number {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6);
  const n = Number(`${whole}.${fracStr}`);
  return negative ? -n : n;
}

export function usd8ToNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return raw / 10 ** USD_FIELD_DECIMALS;
}

export function sideFromOptionType(typeRaw: number): string | null {
  switch (typeRaw) {
    case 0:
    case 3:
      return 'PUMP';
    case 1:
    case 4:
      return 'DUMP';
    case 2:
    case 5:
      return 'RANGE';
    default:
      return null;
  }
}

export function buildMarketLabel(
  client: ThetanutsClient,
  underlying: string,
  strikes: bigint[],
): string {
  const fmt = (s: bigint) =>
    `$${Number(client.utils.fromStrikeDecimals(s)).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  return `${underlying} ${strikes.map(fmt).join(' / ')}`;
}

// `tradeKey` and `prefixTx` now live in src/lib/txKey.ts — a shared module with
// neither `'use client'` nor `server-only`, so this server sync and the browser
// `explorer.ts` canonicalise identifiers through the SAME code instead of two
// hand-mirrored copies that could drift (the drift that once silently dropped
// every settlement). See that file for the indexer-vs-DB format mismatch.

export function findBuyerPosition(
  h: TradeHistory,
  positions: Position[],
): Position | undefined {
  const optionAddr = h.option.address.toLowerCase();
  const buyer = h.buyer.toLowerCase();
  const candidates = positions.filter(
    (p) =>
      p.optionAddress.toLowerCase() === optionAddr &&
      p.buyer.toLowerCase() === buyer &&
      p.side === 'buyer',
  );
  if (candidates.length === 0) {
    // Broker fills: the position row and the history row can disagree on `buyer`
    // (broker on one side, taker on the other), so the equality filter above
    // misses. The entry (fill) tx hash is the precise join — exactly one buyer
    // position per fill tx — so fall back to it before giving up. Strictly
    // additive: this branch only runs when buyer-matching already found nothing.
    return positions.find(
      (p) =>
        p.optionAddress.toLowerCase() === optionAddr &&
        p.side === 'buyer' &&
        normTx(p.entryTxHash) === normTx(h.txHash),
    );
  }
  if (candidates.length === 1) return candidates[0];
  // The wallet filled this same option more than once, so there are multiple
  // buyer positions. Disambiguate by the entry tx (h.txHash is the fill tx —
  // the same hash this history row was matched to its DB trade by) so each
  // settlement's PnL attaches to ITS OWN position. Without this they all
  // collapse onto the first candidate, double-counting one position's pnlUsd
  // into the leaderboard and dropping the other.
  const byTx = candidates.find((p) => normTx(p.entryTxHash) === normTx(h.txHash));
  return byTx ?? candidates[0];
}

function indexerCostUsd(p: Position | undefined): number | null {
  if (!p) return null;
  const buyerEntry = p.pnlEntries?.find((e) => e.side === 'buyer');
  return usd8ToNumber(buyerEntry?.costUsd ?? null);
}

function indexerPnlUsd(p: Position | undefined): number | null {
  if (!p) return null;
  return usd8ToNumber(p.pnlUsd ?? null);
}

export interface SyncResult {
  tradesUpserted: number;
  settlementsUpserted: number;
}

// ─── Platform-specific write-on-fill ────────────────────────────────────────
// Written directly from the UI after fillOrder succeeds. Only ever contains
// trades placed on Polynuts — the indexer is never consulted for entry data.

export interface FillPayload {
  tx_hash: string;
  option_id: string;
  taker_address: string;
  market_label: string;
  // PUMP | DUMP | RANGE for UI-written fills; null for cron-recovered fills
  // whose direction we can't derive from the OrderFilled event alone.
  side: string | null;
  contracts: number;
  notional_usdc: number;
  // Real per-contract premium for UI fills; null when unknown (recovered).
  entry_price: number | null;
  created_at: string;
}

export async function writeFillToDb(
  sb: SupabaseClient,
  data: FillPayload,
  opts: { ignoreDuplicates?: boolean } = {},
): Promise<void> {
  const { error: traderErr } = await sb
    .from('traders')
    .upsert({ address: data.taker_address }, { onConflict: 'address' });
  if (traderErr) throw traderErr;

  // ignoreDuplicates=true (the cron recovery path) inserts ONLY when the
  // (tx_hash, option_id) row is absent, so a rich UI-written row is never
  // overwritten by the recovery placeholder (notional 0 / 'recovered' / now()),
  // which would corrupt the recent-trades feed, admin volume and last_trade_at.
  // The UI POST path leaves it false so it can still upgrade a prior placeholder.
  const { error } = await sb
    .from('trades')
    .upsert(data, {
      onConflict: 'tx_hash,option_id',
      ignoreDuplicates: opts.ignoreDuplicates ?? false,
    });
  if (error) throw error;
}

// ─── Settlement-only sync ────────────────────────────────────────────────────
// Checks the indexer for settlements on trades already in our DB (written
// via writeFillToDb). Never adds new trade rows — only updates settlements.
// This keeps the indexer out of the entry path while still getting accurate
// PnL math for settled options (which the indexer computes correctly across
// all product families including inverse-collateral).

export async function syncSettlementsOnly(
  sb: SupabaseClient,
  client: ThetanutsClient,
  address: string,
): Promise<{ settlementsUpserted: number }> {
  const addr = address.toLowerCase();

  // Fetch only open (unsettled) trades for this address.
  const { data: dbTrades, error: dbErr } = await sb
    .from('trades')
    .select('id, tx_hash, option_id, settlements(id)')
    .eq('taker_address', addr);
  if (dbErr) throw dbErr;

  const openTrades = (dbTrades ?? []).filter(
    (t) =>
      !Array.isArray((t as { settlements?: unknown[] }).settlements) ||
      ((t as { settlements: unknown[] }).settlements).length === 0,
  );
  if (openTrades.length === 0) return { settlementsUpserted: 0 };

  const byKey = new Map<string, number>(
    openTrades.map((t) => [
      tradeKey(
        (t as { tx_hash: string }).tx_hash,
        (t as { option_id: string }).option_id,
      ),
      (t as { id: number }).id,
    ]),
  );

  const [history, positions]: [TradeHistory[], Position[]] = await Promise.all([
    client.api.getUserHistoryFromIndexer(addr),
    client.api.getUserPositionsFromIndexer(addr),
  ]);

  // On broker fills the indexer may report `buyer` as the broker, not the taker.
  // The `byKey.has(...)` check already scopes every match to THIS taker's own DB
  // trades (written + on-chain-verified by POST), so also accepting the broker
  // as buyer here is safe and lets broker-routed settlements attach.
  const broker = configuredBrokerAddress();
  const settlementRows = history
    .filter(
      (h) =>
        h.settlement &&
        (h.buyer.toLowerCase() === addr ||
          (broker != null && h.buyer.toLowerCase() === broker)) &&
        byKey.has(tradeKey(h.txHash, h.option.address)),
    )
    .map((h) => {
      const tradeId = byKey.get(tradeKey(h.txHash, h.option.address))!;
      const payout = bigintToNumber(h.settlement!.payoutBuyer, USDC_DECIMALS);
      const matched = findBuyerPosition(h, positions);
      let pnl = indexerPnlUsd(matched);
      if (pnl == null) {
        const cost = indexerCostUsd(matched);
        if (cost != null) pnl = payout - cost;
      }
      if (pnl == null) return null;
      return {
        trade_id: tradeId,
        settle_price: bigintToNumber(h.settlement!.settlementPrice, PRICE_DECIMALS),
        payout_usdc: payout,
        pnl_usdc: pnl,
        is_win: pnl > 0,
        // The CLOSE tx is the one that actually transfers the buyer's USDC
        // payout (verified on-chain: the `settle` tx only records the oracle
        // price and moves no money to the buyer). This is the "proof I got
        // paid" link surfaced on settled rows.
        settle_tx_hash: prefixTx(h.closeTxHash),
        settled_at: new Date(Number(h.closeTimestamp) * 1000).toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let settlementsUpserted = 0;
  if (settlementRows.length > 0) {
    const { error, count } = await sb
      .from('settlements')
      .upsert(settlementRows, { onConflict: 'trade_id', count: 'exact' });
    if (error) throw error;
    settlementsUpserted = count ?? settlementRows.length;
  }

  return { settlementsUpserted };
}

/**
 * Fetch one user's history + positions from the Thetanuts indexer and
 * upsert their trades + settlements into Supabase. Idempotent — safe to
 * call on every page visit.
 *
 * Cost basis and realized PnL are sourced from the indexer's
 * `Position.pnlUsd` (8-dec string) and `pnlEntries[].costUsd`. The naive
 * `h.amount × h.price / 1e8` formula is NOT used because `h.price` is
 * `mmPrice` (probability-like) not per-contract premium for inverse-
 * collateral options.
 */
export async function syncUserFromIndexer(
  sb: SupabaseClient,
  client: ThetanutsClient,
  address: string,
): Promise<SyncResult> {
  const addr = address.toLowerCase();

  // Ensure the trader row exists before we upsert any trades that
  // reference it (foreign key).
  const { error: traderErr } = await sb
    .from('traders')
    .upsert({ address: addr }, { onConflict: 'address' });
  if (traderErr) throw traderErr;

  const [history, positions]: [TradeHistory[], Position[]] = await Promise.all([
    client.api.getUserHistoryFromIndexer(addr),
    client.api.getUserPositionsFromIndexer(addr),
  ]);

  // Accept broker-routed fills too: the indexer queries by `addr` (this taker),
  // so any row it returns is theirs even when `buyer` is the broker contract.
  // Without this the cron recovery silently skips every broker fill.
  const broker = configuredBrokerAddress();
  const isOurBuyer = (h: TradeHistory) =>
    h.buyer.toLowerCase() === addr || (broker != null && h.buyer.toLowerCase() === broker);

  const fills = history.filter((h) => h.type === 'fill' && isOurBuyer(h));

  const tradeRows = fills.map((h) => {
    const matched = findBuyerPosition(h, positions);
    const cost = indexerCostUsd(matched);
    return {
      tx_hash: h.txHash,
      option_id: h.option.address,
      taker_address: addr,
      market_label: buildMarketLabel(client, h.option.underlying, h.strikes),
      side: sideFromOptionType(h.optionTypeRaw),
      contracts: bigintToNumber(h.amount, USDC_DECIMALS),
      notional_usdc: cost ?? 0,
      entry_price: bigintToNumber(h.price, PRICE_DECIMALS),
      created_at: new Date(h.timestamp * 1000).toISOString(),
    };
  });

  let tradesUpserted = 0;
  let settlementsUpserted = 0;

  if (tradeRows.length === 0) return { tradesUpserted, settlementsUpserted };

  const { data: upserted, error: upErr } = await sb
    .from('trades')
    .upsert(tradeRows, { onConflict: 'tx_hash,option_id' })
    .select('id,tx_hash,option_id');
  if (upErr) throw upErr;
  tradesUpserted = upserted?.length ?? 0;

  const byKey = new Map<string, number>();
  for (const row of upserted ?? []) {
    byKey.set(tradeKey(row.tx_hash, row.option_id), row.id as number);
  }

  const settlementRows = history
    .filter(
      (h) =>
        h.settlement &&
        isOurBuyer(h) &&
        byKey.has(tradeKey(h.txHash, h.option.address)),
    )
    .map((h) => {
      const tradeId = byKey.get(tradeKey(h.txHash, h.option.address))!;
      const payout = bigintToNumber(h.settlement!.payoutBuyer, USDC_DECIMALS);
      const matched = findBuyerPosition(h, positions);
      let pnl = indexerPnlUsd(matched);
      if (pnl == null) {
        const cost = indexerCostUsd(matched);
        if (cost != null) pnl = payout - cost;
      }
      if (pnl == null) return null;
      return {
        trade_id: tradeId,
        settle_price: bigintToNumber(h.settlement!.settlementPrice, PRICE_DECIMALS),
        payout_usdc: payout,
        pnl_usdc: pnl,
        is_win: pnl > 0,
        // The CLOSE tx is the one that actually transfers the buyer's USDC
        // payout (verified on-chain: the `settle` tx only records the oracle
        // price and moves no money to the buyer). This is the "proof I got
        // paid" link surfaced on settled rows.
        settle_tx_hash: prefixTx(h.closeTxHash),
        settled_at: new Date(Number(h.closeTimestamp) * 1000).toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (settlementRows.length > 0) {
    const { error: sErr, count } = await sb
      .from('settlements')
      .upsert(settlementRows, { onConflict: 'trade_id', count: 'exact' });
    if (sErr) throw sErr;
    settlementsUpserted = count ?? settlementRows.length;
  }

  return { tradesUpserted, settlementsUpserted };
}

export interface DbTradeRow {
  id: number;
  tx_hash: string;
  option_id: string;
  market_label: string | null;
  side: string | null;
  contracts: number;
  notional_usdc: number;
  entry_price: number | null;
  created_at: string;
  settle_price: number | null;
  payout_usdc: number | null;
  pnl_usdc: number | null;
  is_win: boolean | null;
  settled_at: string | null;
  /** On-chain payout (close) tx hash — Basescan proof the buyer was paid. */
  settle_tx_hash: string | null;
}

/**
 * Read the user's trades joined with settlements. Returns one row per
 * trade; settlement fields are null for unsettled (still-open) trades.
 */
export async function readUserTrades(
  sb: SupabaseClient,
  address: string,
  limit = 500,
): Promise<DbTradeRow[]> {
  const addr = address.toLowerCase();
  const { data, error } = await sb
    .from('trades')
    .select(
      `
        id,
        tx_hash,
        option_id,
        market_label,
        side,
        contracts,
        notional_usdc,
        entry_price,
        created_at,
        settlements (
          settle_price,
          payout_usdc,
          pnl_usdc,
          is_win,
          settled_at,
          settle_tx_hash
        )
      `,
    )
    .eq('taker_address', addr)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((r) => {
    // PostgREST returns the embedded resource as an array; for a 1:1 FK
    // it's at most one element.
    const s = Array.isArray((r as { settlements?: unknown }).settlements)
      ? ((r as unknown as { settlements: Array<Record<string, unknown>> })
          .settlements[0] ?? null)
      : ((r as unknown as { settlements: Record<string, unknown> | null })
          .settlements ?? null);
    return {
      id: r.id as number,
      tx_hash: r.tx_hash as string,
      option_id: r.option_id as string,
      market_label: (r.market_label as string | null) ?? null,
      side: (r.side as string | null) ?? null,
      contracts: Number(r.contracts ?? 0),
      notional_usdc: Number(r.notional_usdc ?? 0),
      entry_price: r.entry_price != null ? Number(r.entry_price) : null,
      created_at: r.created_at as string,
      settle_price: s?.settle_price != null ? Number(s.settle_price) : null,
      payout_usdc: s?.payout_usdc != null ? Number(s.payout_usdc) : null,
      pnl_usdc: s?.pnl_usdc != null ? Number(s.pnl_usdc) : null,
      is_win: typeof s?.is_win === 'boolean' ? s.is_win : null,
      settled_at: (s?.settled_at as string | null) ?? null,
      settle_tx_hash: (s?.settle_tx_hash as string | null) ?? null,
    };
  });
}
