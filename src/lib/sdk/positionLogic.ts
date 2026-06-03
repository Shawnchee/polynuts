import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';

const PRICE_DECIMALS = 8;
const USD_FIELD_DECIMALS = 8; // Position.pnlUsd, pnlEntries[].costUsd / valueUsd are encoded as 8-dec strings

export function isOpen(p: Position): boolean {
  if (p.settlement) return false;
  if (p.optionStatus && p.optionStatus !== 'active') return false;
  if (p.status && /settl|closed|expired/i.test(p.status)) return false;
  return true;
}

export function isSettled(p: Position): boolean {
  return !isOpen(p);
}

export function pnlUsd(p: Position): number {
  const client = getReadClient();
  if (p.pnlUsd != null) {
    const raw = Number(p.pnlUsd);
    if (Number.isFinite(raw)) return raw / 10 ** USD_FIELD_DECIMALS;
  }
  try {
    const v = Number(client.utils.fromUsdcDecimals(p.pnl));
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function pnlPct(p: Position): number | undefined {
  if (p.pnlPct != null) {
    const v = Number(p.pnlPct);
    if (Number.isFinite(v)) return v;
  }
  const cost = costBasisUsd(p);
  const pnl = pnlUsd(p);
  if (!Number.isFinite(pnl) || !Number.isFinite(cost) || cost <= 0) return undefined;
  return (pnl / cost) * 100;
}

export function costBasisUsd(p: Position): number {
  const client = getReadClient();
  try {
    const entry = Number(client.utils.fromPriceDecimals(p.entryPrice));
    const amount = Number(client.utils.formatAmount(p.amount, p.collateralDecimals || 6, 6));
    const v = entry * amount;
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function hasFinitePnl(p: Position): boolean {
  return Number.isFinite(pnlUsd(p));
}

/**
 * Realized PnL in USD for a SETTLED position.
 *
 * This is the trustworthy path: the indexer computes `pnlUsd` from the
 * raw fill premium + settlement payout in the option's native decimals
 * (which differ between inverse-collateral BTC/ETH spreads, USDC-linear
 * options, and physical settlement). Reconstructing those from
 * `TradeHistory.amount` and `TradeHistory.price` alone is not safe
 * because the indexer's `price` field encodes `mmPrice` (probability-
 * like, requires `spot` to recover the per-contract premium) rather
 * than the per-contract premium itself.
 *
 * Returns NaN if PnL data is unavailable on the position.
 */
export function realizedPnlUsdFromPosition(p: Position): number {
  return pnlUsd(p);
}

/**
 * Match a TradeHistory entry to its corresponding settled Position by
 * (optionAddress, buyer). Returns undefined if no match.
 *
 * Used to bridge `TradeHistory` rows (which carry settlement metadata
 * but not reliable cost) to `Position` records (which carry indexer-
 * computed `pnlUsd`).
 */
export function findSettledPositionForHistory(
  h: TradeHistory,
  positions: Position[] | undefined,
): Position | undefined {
  if (!positions || positions.length === 0) return undefined;
  const optionAddr = h.option.address.toLowerCase();
  const buyer = h.buyer.toLowerCase();
  // Settle/exercise rows: the buyer's settled position lives in `positions`
  // with matching optionAddress. The Position side may be either buyer or
  // seller; for realized PnL on a buyer-side settle we want the buyer one.
  return positions.find(
    (p) =>
      p.optionAddress.toLowerCase() === optionAddr &&
      p.buyer.toLowerCase() === buyer &&
      p.side === 'buyer' &&
      !!p.settlement,
  );
}

/**
 * Net realized PnL for a settled buyer-side trade.
 *
 * Preferred path: pass `positions` from `usePositions()`. The function
 * matches `h` to its `Position` and returns the indexer-computed
 * `pnlUsd` — the only reliable cross-product cost basis (handles
 * inverse-collateral BTC/ETH spreads correctly).
 *
 * Legacy path (no positions passed): falls back to a naive
 *   payout − (amount × price / 1e8)
 * calculation. This is INCORRECT for inverse-collateral options
 * (BTC/ETH spreads against USDC) because the indexer's `price` field
 * encodes `mmPrice` (probability-like) rather than per-contract
 * premium. Callers should pass `positions` whenever available; the
 * fallback exists only for backward compatibility with call sites that
 * haven't been updated yet.
 *
 * Returns NaN if not a settled buyer fill or the data is incomplete.
 */
export function realizedPnlUsd(h: TradeHistory, positions?: Position[]): number {
  if (!h.settlement) return NaN;

  // Preferred: position-derived PnL from the indexer.
  const matched = findSettledPositionForHistory(h, positions);
  if (matched) {
    const v = realizedPnlUsdFromPosition(matched);
    if (Number.isFinite(v)) return v;
  }

  // Legacy fallback — known to be wrong for inverse-collateral options.
  // Kept so call sites that haven't been updated to pass `positions`
  // continue to return *some* number rather than throwing. The activity
  // page filters non-finite values, so returning NaN here would silently
  // drop the row from lifetime stats; the old (wrong) number is at least
  // visually consistent with the existing buggy "cost" column. Once all
  // call sites pass `positions`, this branch becomes dead code.
  const client = getReadClient();
  try {
    const dec = h.collateralDecimals || 6;
    const payout = Number(client.utils.formatAmount(h.settlement.payoutBuyer, dec, dec));
    const costBig = (h.amount * h.price) / 10n ** BigInt(PRICE_DECIMALS);
    const cost = Number(client.utils.formatAmount(costBig, dec, dec));
    const v = payout - cost;
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Cost basis (premium paid) in USD for a settled buyer-side trade.
 *
 * Preferred path: pass `positions` so we can read `cost` from the
 * indexer's `pnlEntries` (USD-denominated, accounts for inverse-
 * collateral math). Falls back to the same buggy formula
 * (amount × price / 1e8) as the legacy `realizedPnlUsd`.
 */
export function costBasisHistoryUsd(h: TradeHistory, positions?: Position[]): number {
  // Preferred: indexer-supplied costUsd from the matched Position's
  // pnlEntries (buyer side, settled exit). Indexer encodes USD fields
  // with 8 decimals — divide.
  const matched = findSettledPositionForHistory(h, positions);
  if (matched) {
    const buyerEntry = matched.pnlEntries?.find((e) => e.side === 'buyer');
    if (buyerEntry?.costUsd != null) {
      const raw = Number(buyerEntry.costUsd);
      if (Number.isFinite(raw)) return raw / 10 ** USD_FIELD_DECIMALS;
    }
    // If we have payout + pnl but no costUsd, derive: cost = payout - pnl.
    if (matched.settlement) {
      const client = getReadClient();
      try {
        const payout = Number(
          client.utils.fromUsdcDecimals(matched.settlement.payoutBuyer),
        );
        const pnl = realizedPnlUsdFromPosition(matched);
        if (Number.isFinite(payout) && Number.isFinite(pnl)) {
          const v = payout - pnl;
          return Number.isFinite(v) ? v : NaN;
        }
      } catch {
        // fall through to legacy
      }
    }
  }

  // Legacy fallback — wrong for inverse-collateral options.
  const client = getReadClient();
  try {
    const dec = h.collateralDecimals || 6;
    const costBig = (h.amount * h.price) / 10n ** BigInt(PRICE_DECIMALS);
    const v = Number(client.utils.formatAmount(costBig, dec, dec));
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function isBuyerSettle(h: TradeHistory, address?: string): boolean {
  if (h.type !== 'settle' && h.type !== 'exercise') return false;
  if (!h.settlement) return false;
  if (!address) return true;
  return h.buyer.toLowerCase() === address.toLowerCase();
}

export interface ActivitySummary {
  lifetimePnl: number;
  winRate: number; // 0..1
  settledCount: number;
  wins: number;
  bestTrade: number;
  bestTradeLabel?: string;
  streak: number; // current consecutive wins from most recent settle
}

/**
 * Aggregate realized stats from buyer-side settled trades.
 * `streak` counts consecutive wins from the most recent settle backward.
 *
 * Pass `positions` (from `usePositions()`) so PnL is derived from the
 * indexer's authoritative `Position.pnlUsd` rather than the legacy
 * (and buggy for inverse-collateral) `amount * price / 1e8` formula.
 */
export function computeActivitySummary(
  history: TradeHistory[],
  address?: string,
  labelOf?: (h: TradeHistory) => string,
  positions?: Position[],
): ActivitySummary {
  const settled = history
    .filter((h) => isBuyerSettle(h, address))
    .map((h) => ({ h, pnl: realizedPnlUsd(h, positions) }))
    .filter(({ pnl }) => Number.isFinite(pnl))
    .sort((a, b) => b.h.timestamp - a.h.timestamp);

  let lifetimePnl = 0;
  let wins = 0;
  let bestTrade = 0;
  let bestTradeLabel: string | undefined;
  for (const { h, pnl } of settled) {
    lifetimePnl += pnl;
    if (pnl > 0) wins++;
    if (pnl > bestTrade) {
      bestTrade = pnl;
      bestTradeLabel = labelOf?.(h);
    }
  }
  let streak = 0;
  for (const { pnl } of settled) {
    if (pnl > 0) streak++;
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
