'use client';

import { useQuery } from '@tanstack/react-query';
import type { OrderFillEvent } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';

export type LeaderboardPeriod = 'day' | 'week' | 'all';

export interface LeaderboardRow {
  address: string;
  /** rough notional volume (USDC, 1e6) traded as taker */
  notional: bigint;
  /** number of fills as taker */
  fills: number;
  /** dominant direction inferred from underlyingToken (best-effort) */
  badge?: string;
}

const SEC_PER_BLOCK_BASE = 2; // Base block time
const NOW = () => Math.floor(Date.now() / 1000);

function lookbackBlocks(period: LeaderboardPeriod, latest: number): number {
  if (period === 'day') return Math.max(0, latest - Math.floor(86_400 / SEC_PER_BLOCK_BASE));
  if (period === 'week') return Math.max(0, latest - Math.floor(7 * 86_400 / SEC_PER_BLOCK_BASE));
  return 0;
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const client = getReadClient();

  return useQuery<LeaderboardRow[]>({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const provider = client.provider;
      const latest = await provider.getBlockNumber();
      const fromBlock =
        period === 'all' ? client.chainConfig.deploymentBlock : lookbackBlocks(period, latest);

      const fills: OrderFillEvent[] = await client.events.getOrderFillEvents({ fromBlock });

      const byTaker = new Map<string, LeaderboardRow>();
      for (const f of fills) {
        const taker = f.taker.toLowerCase();
        // Notional ≈ numContracts × price, both 8 decimals on chain → divide by 1e10
        // to land in 6-decimal USDC space (price is in collateral 8-dec, contracts 8-dec).
        const notional = (f.numContracts * f.price) / 10n ** 8n;
        const existing = byTaker.get(taker);
        if (existing) {
          existing.notional += notional;
          existing.fills += 1;
        } else {
          byTaker.set(taker, { address: taker, notional, fills: 1 });
        }
      }

      return [...byTaker.values()]
        .sort((a, b) => (a.notional > b.notional ? -1 : a.notional < b.notional ? 1 : 0))
        .slice(0, 100);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
