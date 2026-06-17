'use client';

import { useCallback, useMemo } from 'react';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import { useAppStore } from '@/store/app';
import { getReadClient } from './clients';
import { normTx } from './explorer';
import { costBasisUsd, unrealizedPnlUsd } from './positionLogic';
import { useTradeHistoryDb, type DbTradeRow } from './useTradeHistoryDb';

export interface PositionMark {
  /** Real premium paid (cost basis) in USD. */
  premiumUsd: number;
  /** Real per-contract entry price in USD. */
  entryPerContractUsd: number;
  /** Live unrealized PnL in USD — NaN when the position can't be marked. */
  unrealizedUsd: number;
  /** Unrealized PnL as a % of premium — undefined when not computable. */
  unrealizedPct: number | undefined;
  /** Live spot used for the mark (undefined if the feed hasn't a price yet). */
  spot: number | undefined;
  /** True when a live mark was produced (vs. premium-at-risk fallback). */
  markable: boolean;
}

/**
 * Returns a resolver that marks an open position to market using the live
 * spot feed and the real premium from our own DB (`notional_usdc`). The
 * indexer's `entryPrice` is an mmPrice (~0.005), not the cash paid, so we
 * deliberately don't trust it for cost basis.
 *
 * Both the portfolio Open Positions table and the History PnL cell call
 * this so they show identical, correct numbers. React Query dedupes the
 * underlying DB fetch, so calling the hook in several places is cheap.
 */
export function usePositionMarks(): (p: Position) => PositionMark {
  const prices = useAppStore((s) => s.prices);
  const { data: dbRows = [] } = useTradeHistoryDb();

  const byTx = useMemo(() => {
    const m = new Map<string, DbTradeRow>();
    for (const r of dbRows) m.set(normTx(r.tx_hash), r);
    return m;
  }, [dbRows]);

  return useCallback(
    (p: Position): PositionMark => {
      const client = getReadClient();
      const db = byTx.get(normTx(p.entryTxHash));

      const contracts = safe(() =>
        Number(client.utils.formatAmount(p.amount, p.collateralDecimals || 6, 6)),
      );

      // Premium (cost basis): prefer our DB's real notional; fall back to the
      // indexer-derived cost only when there's no matching fill on record.
      const premiumUsd =
        db?.notional_usdc != null && Number.isFinite(db.notional_usdc)
          ? db.notional_usdc
          : costBasisUsd(p);

      const entryPerContractUsd =
        db?.entry_price != null && Number.isFinite(db.entry_price)
          ? db.entry_price
          : contracts != null && contracts > 0 && Number.isFinite(premiumUsd)
          ? premiumUsd / contracts
          : safe(() => Number(client.utils.fromPriceDecimals(p.entryPrice))) ?? NaN;

      const asset = p.option.underlying.toUpperCase();
      const spot =
        asset === 'ETH' ? prices.ETH : asset === 'BTC' ? prices.BTC : undefined;

      const unrealizedUsd = unrealizedPnlUsd(p, spot, premiumUsd);
      const unrealizedPct =
        Number.isFinite(unrealizedUsd) && Number.isFinite(premiumUsd) && premiumUsd > 0
          ? (unrealizedUsd / premiumUsd) * 100
          : undefined;

      return {
        premiumUsd,
        entryPerContractUsd,
        unrealizedUsd,
        unrealizedPct,
        spot,
        markable: Number.isFinite(unrealizedUsd),
      };
    },
    [byTx, prices],
  );
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
