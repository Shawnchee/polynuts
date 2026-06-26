// Pure view-model logic for the portfolio "History" section, sourced
// EXCLUSIVELY from our own Supabase DB (Polynuts trades only — consistent with
// the leaderboard). Extracted out of the React component so the join + dedup +
// cost-basis-preference logic — the part most prone to the indexer↔DB format
// mismatch that once silently dropped settlements — is unit-testable without a
// live client or RPC.
//
// Directive-free on purpose (no 'use client' / server-only). The only client
// dependency, number formatting, is injected via `TradeFormatter` so tests pass
// a stub. `isOpen`/`pnlUsd` are imported from positionLogic; both are pure given
// a position whose `pnlUsd` is already populated (the indexer always supplies it
// for open positions).
import type { Position } from '@thetanuts-finance/thetanuts-client';
import { getDirectionFromImpl } from './markets';
import { isOpen, pnlUsd, type ActivitySummary } from './positionLogic';
import type { DbTradeRow } from './useTradeHistoryDb';
import { normTx } from '@/lib/txKey';

export type Direction = 'PUMP' | 'DUMP' | 'RANGE';

/** A unified portfolio-history row: either a live open position (indexer-backed,
 * with streaming PnL) or a settled/filled trade from our DB. */
export interface MergedRow {
  key: string;
  ts: number;
  source: 'position' | 'history';
  /** Set only for live open positions — drives the streaming PnL cell. */
  position?: Position;
  label: string;
  asset: string;
  direction?: Direction;
  side?: 'buyer' | 'seller';
  contracts?: number;
  usdc?: number;
  entryPrice?: number;
  settlePrice?: number;
  realizedPnl?: number;
  status: string;
  txHash?: string;
  /** On-chain payout (close) tx — Basescan proof the buyer was paid. */
  settleTxHash?: string;
}

/** One settled-day point for the PnL calendar. Structurally matches
 * `PnlEntry` in components/activity/PnlCalendar. */
export interface CalendarEntry {
  ts: number;
  pnl: number;
}

/**
 * The slice of the Thetanuts client's `utils` the merge needs, narrowed so the
 * module stays testable with a stub (no live client / RPC). `getReadClient().utils`
 * satisfies it structurally.
 */
export interface TradeFormatter {
  formatAmount(amount: bigint, decimals: number, displayDecimals: number): string;
  fromPriceDecimals(value: bigint): string;
  fromStrikeDecimals(value: bigint): string;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function buildLabel(underlying: string, strikes: bigint[], fmt: TradeFormatter): string {
  const f = (s: bigint) =>
    `$${Number(fmt.fromStrikeDecimals(s)).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  return `${underlying} ${strikes.map(f).join(' / ')}`;
}

function directionOf(
  optionType: number | undefined,
  strikeCount: number,
  raw?: number,
): Direction | undefined {
  const t = optionType ?? raw;
  if (t == null) {
    if (strikeCount >= 2) return 'RANGE';
    return undefined;
  }
  // Matches sideFromOptionType in src/lib/supabase/sync.ts — must stay in sync
  // with what is stored in the DB so labels agree across sources.
  if (t === 0 || t === 3) return 'PUMP';
  if (t === 1 || t === 4) return 'DUMP';
  if (t === 2 || t === 5) return 'RANGE';
  return undefined;
}

/**
 * Direction of an OPEN position. The indexer's `option.optionType` is the
 * base-leg type (call = 0) for multi-leg structures, so a put spread (DUMP)
 * misreads as PUMP if you trust it. Prefer the implementation name
 * (authoritative — e.g. PUT_SPREAD → DUMP), then the raw option type, then the
 * structured type. Mirrors `isCallFamily` in positionLogic.
 */
function directionOfPosition(p: Position): Direction | undefined {
  if (p.implementationName) {
    const d = getDirectionFromImpl(p.implementationName);
    if (d) return d;
  }
  return directionOf(p.optionTypeRaw ?? p.option.optionType, p.option.strikes.length);
}

/**
 * Build merged history rows from our DB (the single read source) plus live
 * open positions from the indexer. Open positions still come from the indexer
 * because the DB doesn't track their live mark, but their cost basis / entry
 * price is taken from the matching DB fill — the indexer's `entryPrice` is an
 * mmPrice (~0.005), not the real premium paid.
 *
 * The position↔DB join is by {@link normTx} (the indexer returns prefix-less,
 * mixed-case hashes; the DB stores 0x-prefixed lowercased ones), and a DB row
 * mirrored by a still-open position is dropped so a live, streaming row wins
 * over a static one.
 */
export function mergeRowsDb(
  positions: Position[],
  dbRows: DbTradeRow[],
  fmt: TradeFormatter,
): MergedRow[] {
  const out: MergedRow[] = [];
  const seenTx = new Set<string>();

  const dbByTx = new Map<string, DbTradeRow>();
  for (const r of dbRows) dbByTx.set(normTx(r.tx_hash), r);

  for (const p of positions) {
    if (!isOpen(p)) continue;
    if (!Number.isFinite(pnlUsd(p))) continue;
    seenTx.add(normTx(p.entryTxHash));
    const contracts = safe(() =>
      Number(fmt.formatAmount(p.amount, p.collateralDecimals || 6, 6)),
    );
    const db = dbByTx.get(normTx(p.entryTxHash));
    // Prefer the real premium from our DB; fall back to the (wrong but
    // non-null) indexer entryPrice only when there's no matching fill.
    const entryPrice =
      db?.entry_price != null
        ? db.entry_price
        : safe(() => Number(fmt.fromPriceDecimals(p.entryPrice)));
    const usdc =
      db?.notional_usdc != null && Number.isFinite(db.notional_usdc)
        ? db.notional_usdc
        : contracts != null && entryPrice != null && Number.isFinite(contracts * entryPrice)
        ? contracts * entryPrice
        : undefined;
    out.push({
      key: `pos-${p.id}`,
      ts: Number(p.entryTimestamp) * 1000,
      source: 'position',
      position: p,
      label: buildLabel(p.option.underlying, p.option.strikes, fmt),
      asset: p.option.underlying,
      direction: directionOfPosition(p),
      side: p.side,
      contracts,
      usdc,
      entryPrice,
      // Indexer open positions report status 'active'; normalize to 'OPEN'.
      status: 'OPEN',
      txHash: p.entryTxHash,
    });
  }

  for (const r of dbRows) {
    // Skip rows mirrored by an active position above (avoid dupes for fills
    // that haven't settled yet — the live position has streaming PnL).
    if (seenTx.has(normTx(r.tx_hash))) continue;
    const direction =
      r.side === 'PUMP' || r.side === 'DUMP' || r.side === 'RANGE'
        ? (r.side as Direction)
        : undefined;
    const settled = !!r.settled_at;
    out.push({
      key: `db-${r.id}`,
      ts: settled ? Date.parse(r.settled_at!) : Date.parse(r.created_at),
      source: 'history',
      label: r.market_label ?? '—',
      asset: '',
      direction,
      side: 'buyer',
      contracts: r.contracts,
      usdc: r.notional_usdc || undefined,
      entryPrice: r.entry_price ?? undefined,
      settlePrice: r.settle_price ?? undefined,
      realizedPnl: r.pnl_usdc ?? undefined,
      status: settled ? 'SETTLE' : 'FILLED',
      txHash: r.tx_hash,
      settleTxHash: r.settle_tx_hash ?? undefined,
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out;
}

/** Lifetime realized stats from settled DB rows (settled_at + pnl present). */
export function summaryFromDbRows(dbRows: DbTradeRow[]): ActivitySummary {
  const settled = dbRows
    .filter((r) => r.settled_at && r.pnl_usdc != null)
    .map((r) => ({
      pnl: r.pnl_usdc as number,
      label: r.market_label ?? '',
      ts: Date.parse(r.settled_at!),
    }))
    .sort((a, b) => b.ts - a.ts);

  let lifetimePnl = 0;
  let wins = 0;
  let bestTrade = 0;
  let bestTradeLabel: string | undefined;
  for (const s of settled) {
    lifetimePnl += s.pnl;
    if (s.pnl > 0) wins++;
    if (s.pnl > bestTrade) {
      bestTrade = s.pnl;
      bestTradeLabel = s.label;
    }
  }
  let streak = 0;
  for (const s of settled) {
    if (s.pnl > 0) streak++;
    else break;
  }
  return {
    lifetimePnl,
    winRate: settled.length ? wins / settled.length : 0,
    settledCount: settled.length,
    wins,
    bestTrade,
    bestTradeLabel,
    streak,
  };
}

/** PnL-calendar points from settled DB rows. */
export function calendarEntriesFromDbRows(dbRows: DbTradeRow[]): CalendarEntry[] {
  return dbRows
    .filter((r) => r.settled_at && r.pnl_usdc != null)
    .map((r) => ({ ts: Date.parse(r.settled_at!), pnl: r.pnl_usdc as number }));
}
