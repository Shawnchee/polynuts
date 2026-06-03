import 'server-only';
import {
  ThetanutsClient,
  type Position,
  type TradeHistory,
} from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function findBuyerPosition(
  h: TradeHistory,
  positions: Position[],
): Position | undefined {
  const optionAddr = h.option.address.toLowerCase();
  const buyer = h.buyer.toLowerCase();
  return positions.find(
    (p) =>
      p.optionAddress.toLowerCase() === optionAddr &&
      p.buyer.toLowerCase() === buyer &&
      p.side === 'buyer',
  );
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

  const fills = history.filter(
    (h) => h.type === 'fill' && h.buyer.toLowerCase() === addr,
  );

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
    byKey.set(`${row.tx_hash}:${row.option_id}`, row.id as number);
  }

  const settlementRows = history
    .filter(
      (h) =>
        h.settlement &&
        h.buyer.toLowerCase() === addr &&
        byKey.has(`${h.txHash}:${h.option.address}`),
    )
    .map((h) => {
      const tradeId = byKey.get(`${h.txHash}:${h.option.address}`)!;
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
          settled_at
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
    };
  });
}
