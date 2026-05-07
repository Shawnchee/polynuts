'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  OrderFillEvent,
  DailyStatsResponse,
} from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';

export type LeaderboardPeriod = 'day' | 'week';

export interface LeaderboardRow {
  address: string;
  /** Premium notional in 6-dec USDC, taker-side */
  notional: bigint;
  fills: number;
}

const SEC_PER_BLOCK_BASE = 2; // Base block time

/**
 * The SDK's `queryFilterChunked` (events.ts) caps event scans at
 * MAX_BLOCK_RANGE × MAX_CHUNKS = 10K × 10 = 100,000 blocks ≈ 2.3 days on
 * Base. Asking for a 7-day window silently returns only the last ~2 days
 * worth of fills with no warning. We clamp the lookback so the period
 * label is honest about what was actually scanned.
 */
const SDK_CHUNKED_BLOCK_CAP = 95_000;

function lookbackBlocks(period: LeaderboardPeriod): number {
  if (period === 'day') return Math.floor(86_400 / SEC_PER_BLOCK_BASE); // ~43200
  // week: clamped to SDK's effective scan limit; the UI labels this honestly
  return SDK_CHUNKED_BLOCK_CAP;
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const client = getReadClient();

  return useQuery<LeaderboardRow[]>({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const provider = client.provider;
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - lookbackBlocks(period));

      const fills: OrderFillEvent[] = await client.events.getOrderFillEvents({
        fromBlock,
      });

      const byTaker = new Map<string, LeaderboardRow>();
      for (const f of fills) {
        const taker = f.taker.toLowerCase();
        // OrderFillEvent.numContracts is USDC-scaled (6-dec); .price is the
        // premium in 8-dec collateral units. Premium notional in 6-dec USDC
        // = numContracts × price / 1e8 (descales price's 8 decimals down to 6).
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
        .sort((a, b) =>
          a.notional > b.notional ? -1 : a.notional < b.notional ? 1 : 0
        )
        .slice(0, 100);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/**
 * Lifetime protocol-wide stats from the OptionBook indexer. Cheaper than
 * an event scan and not subject to the SDK's chunked-block cap, so this
 * gives us a real all-time number for the page header even though the
 * per-trader leaderboard table can only cover a recent window.
 */
export function useBookDailyStats() {
  const client = getReadClient();
  return useQuery<DailyStatsResponse>({
    queryKey: ['book-daily-stats'],
    queryFn: () => client.api.getBookDailyStats(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export interface ProtocolHeaderStats {
  totalTrades: number;
  totalVolumeUsd: number;
  daysCovered: number;
  /** Most recent day in the daily stats response */
  latestDate: string | null;
}

export function reduceDailyStats(
  data: DailyStatsResponse | undefined
): ProtocolHeaderStats {
  if (!data?.daily?.length) {
    return { totalTrades: 0, totalVolumeUsd: 0, daysCovered: 0, latestDate: null };
  }
  let trades = 0;
  let volume = 0;
  for (const d of data.daily) {
    trades += d.trades;
    const v = Number(d.volumeUsd);
    if (Number.isFinite(v)) volume += v;
  }
  const sortedDates = [...data.daily].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );
  return {
    totalTrades: trades,
    totalVolumeUsd: volume,
    daysCovered: data.daily.length,
    latestDate: sortedDates[0]?.date ?? null,
  };
}
