import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';
import { getDirectionFromImpl } from './markets';
import { normTx } from '@/lib/txKey';

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

/**
 * ⚠️ Returns an mmPrice-based figure, NOT the cash premium paid. `p.entryPrice`
 * is the indexer's mmPrice (probability-like, ~0.005), so this understates the
 * real dollar cost by orders of magnitude. Do NOT show this as a user-facing
 * dollar cost or use it as a PnL/ROI denominator — prefer the DB's
 * `notional_usdc`, then {@link premiumPaidUsd}. Kept only for internal/legacy
 * callers that explicitly want the mmPrice notional.
 */
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

/**
 * Premium actually paid (cost basis) in USD, read from the indexer's
 * `pnlEntries[].costUsd` (buyer side, 8-dec USD). This is the authoritative
 * basis across all product families (incl. inverse-collateral spreads), unlike
 * {@link costBasisUsd} which is mmPrice-based and wildly understates cost.
 * Returns NaN when the indexer hasn't supplied a cost entry, so callers render
 * "—" rather than a fabricated near-zero number.
 */
export function premiumPaidUsd(p: Position): number {
  const buyerEntry = p.pnlEntries?.find((e) => e.side === 'buyer');
  if (buyerEntry?.costUsd != null) {
    const raw = Number(buyerEntry.costUsd);
    if (Number.isFinite(raw)) return raw / 10 ** USD_FIELD_DECIMALS;
  }
  return NaN;
}

export function hasFinitePnl(p: Position): boolean {
  return Number.isFinite(pnlUsd(p));
}

/**
 * Is this position a call-direction (PUMP) product? Returns:
 *   true  → call family (PUMP)
 *   false → put family (DUMP)
 *   null  → range / unknown (the 1–2 strike directional payout helper
 *           doesn't apply; callers compute range marks by decomposition)
 *
 * Prefers the indexer's `implementationName`; falls back to the raw option
 * type (0/3 → call, 1/4 → put, 2/5 → range) — the same mapping as
 * sideFromOptionType in supabase/sync.ts.
 */
function isCallFamily(p: Position): boolean | null {
  const impl = p.implementationName;
  const dir = impl ? getDirectionFromImpl(impl) : null;
  if (dir === 'PUMP') return true;
  if (dir === 'DUMP') return false;
  if (dir === 'RANGE') return null;
  const t = p.optionTypeRaw ?? p.option.optionType;
  if (t === 0 || t === 3) return true;
  if (t === 1 || t === 4) return false;
  return null;
}

/**
 * Intrinsic payout (6-dec USDC) of a structured product at a settlement
 * price, computed entirely through the SDK's call-spread primitive so the
 * decimal scaling is the SDK's, not ours. Shared by the live position mark
 * and the confirm modal's "settle now" value so they never disagree.
 *
 * `strikesAsc` must be ascending (the helper's spread convention is
 * [lower, upper]); `sizeContracts` is in OPTION_SIZE (18) decimals;
 * `settlePrice8` is the settlement price in 8 decimals.
 *
 *   1–2 strikes → direct call/put (+spread) via `isCall`
 *   3 strikes   → callSpread(lo,mid) − callSpread(mid,hi)   (butterfly)
 *   4+ strikes  → callSpread(s0,s1) − callSpread(s2,s3)     (condor/ranger)
 *
 * Flies and condors/rangers have a direction-agnostic payoff (they pay in
 * the middle band), so the call-spread decomposition is correct for both
 * call- and put-framed variants. It is exact for EQUIDISTANT wings, which
 * is the only shape Thetanuts mints (the factory validators enforce equal
 * spread widths); asymmetric strikes can't occur for a real product.
 * Returns null when inputs are malformed.
 */
export function intrinsicPayoutUsdc(
  strikesAsc: bigint[],
  isCall: boolean | null,
  sizeContracts: bigint,
  settlePrice8: bigint,
): bigint | null {
  if (sizeContracts <= 0n || strikesAsc.length === 0) return null;
  const client = getReadClient();
  const cs = (lo: bigint, hi: bigint): bigint =>
    client.utils.calculatePayoutAtPrice(
      { optionType: 0, strikes: [lo, hi] },
      sizeContracts,
      settlePrice8,
    );
  try {
    let payout: bigint;
    if (strikesAsc.length <= 2) {
      if (isCall == null) return null;
      payout = client.utils.calculatePayoutAtPrice(
        { optionType: isCall ? 0 : 1, strikes: strikesAsc },
        sizeContracts,
        settlePrice8,
      );
    } else if (strikesAsc.length === 3) {
      payout = cs(strikesAsc[0], strikesAsc[1]) - cs(strikesAsc[1], strikesAsc[2]);
    } else {
      payout = cs(strikesAsc[0], strikesAsc[1]) - cs(strikesAsc[2], strikesAsc[3]);
    }
    return payout < 0n ? 0n : payout;
  } catch {
    return null;
  }
}

/**
 * Live intrinsic mark of an OPEN position in USD — the payout it would
 * realise if the underlying settled at `spot` right now.
 *
 * The Thetanuts indexer does NOT mark open positions to market (its
 * `pnlUsd` is computed only at settlement, so it reads 0 while a position
 * is live). We reconstruct the intrinsic value entirely through the SDK's
 * pure-JS `calculatePayoutAtPrice` primitive — no homegrown decimal
 * scaling:
 *
 *   1 strike  (vanilla call/put)   → direct call/put payout
 *   2 strikes (call/put spread)    → direct spread payout
 *   3 strikes (butterfly)          → callSpread(lo,mid) − callSpread(mid,hi)
 *   4 strikes (condor / ranger)    → callSpread(s0,s1) − callSpread(s2,s3)
 *
 * Butterflies and condors/rangers have a direction-agnostic payoff shape
 * (they pay when price lands in the middle band), so the call-spread
 * decomposition is correct for both their call- and put-framed variants.
 * The SDK helper expects ascending strikes for spreads, which is what we
 * pass.
 *
 * Returns NaN when `spot` is unavailable or the inputs are malformed — the
 * caller then shows the premium-at-risk rather than a fabricated number.
 */
export function markToMarketUsd(p: Position, spot: number | undefined): number {
  if (typeof spot !== 'number' || !Number.isFinite(spot) || spot <= 0) return NaN;
  // Only USDC-collateralised products (6-dec) settle in USDC, which is what
  // calculatePayoutAtPrice's default decimals assume. Inverse-collateral
  // vanilla calls (BTC/ETH collateral) would mark in the underlying, not
  // dollars — skip them rather than show a wrong number. Polynuts'
  // spreads/condors/rangers are all USDC-collateralised, so this only
  // excludes a minority vanilla case.
  if ((p.collateralDecimals || 6) !== 6) return NaN;
  const client = getReadClient();
  // calculatePayoutAtPrice expects numContracts in OPTION_SIZE (18) decimals
  // — verified against the SDK: 1e18 contracts on a $50 spread → $50. The
  // indexer's `amount` (like previewFillOrder's numContracts) is in the
  // 6-dec collateral scale, so scale it up by 10^(18−6) before marking.
  const contracts = p.amount * 10n ** BigInt(18 - (p.collateralDecimals || 6));
  if (contracts <= 0n) return NaN;

  const strikes = [...p.option.strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let settle: bigint;
  try {
    settle = client.utils.toPriceDecimals(spot);
  } catch {
    return NaN;
  }

  const payout = intrinsicPayoutUsdc(strikes, isCallFamily(p), contracts, settle);
  if (payout == null) return NaN;
  const v = Number(client.utils.fromUsdcDecimals(payout));
  return Number.isFinite(v) ? v : NaN;
}

/**
 * Live unrealized PnL of an OPEN position: what it's worth if settled at
 * the current `spot` minus the premium actually paid.
 *
 *   - out-of-the-money now → intrinsic ≈ 0 → PnL ≈ −premium
 *   - in-the-money now     → intrinsic rises → PnL improves toward max win
 *
 * `premiumPaid` must be the real USDC premium (from our own DB), NOT the
 * indexer's `entryPrice` (an mmPrice ~0.005, not the cash paid). Returns
 * NaN when the position can't be marked (no live spot, etc.).
 */
export function unrealizedPnlUsd(
  p: Position,
  spot: number | undefined,
  premiumPaid: number,
): number {
  const mark = markToMarketUsd(p, spot);
  if (!Number.isFinite(mark) || !Number.isFinite(premiumPaid)) return NaN;
  return mark - premiumPaid;
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
  const candidates = positions.filter(
    (p) =>
      p.optionAddress.toLowerCase() === optionAddr &&
      p.buyer.toLowerCase() === buyer &&
      p.side === 'buyer' &&
      !!p.settlement,
  );
  if (candidates.length <= 1) return candidates[0];
  // Multiple settled buyer positions on the same option (the wallet filled it
  // more than once): match by the entry tx so realized PnL doesn't all collapse
  // onto the first. Mirrors findBuyerPosition in supabase/sync.ts.
  const byTx = candidates.find((p) => normTx(p.entryTxHash) === normTx(h.txHash));
  return byTx ?? candidates[0];
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
