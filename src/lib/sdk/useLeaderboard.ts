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
        // OrderFillEvent.numContracts is USDC-scaled (6-dec); .price is the
        // premium in 8-dec collateral units. Premium notional in 6-dec USDC =
        // numContracts × price / 1e8 (descales price's 8 decimals down to 6).
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
