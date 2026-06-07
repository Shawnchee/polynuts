'use client';

import { useQuery } from '@tanstack/react-query';
import { CountUp } from './CountUp';
import { useBookDailyStats, reduceDailyStats } from '@/lib/sdk/useLeaderboard';
import { useMarkets } from '@/lib/sdk/useOrders';
import { getReadClient } from '@/lib/sdk/clients';

/**
 * Protocol stat strip — real numbers, not marketing mock-ups.
 *
 *   • Lifetime volume / total trades / days live  ← OptionBook daily-stats indexer
 *   • Live markets                                ← current order-book length
 *
 * Each cell shows a pulsing skeleton until its source resolves, then mounts
 * a fresh CountUp so the animation runs once against the real value (CountUp
 * captures `to` when it starts, so we never animate toward a placeholder).
 */

type Compact = { to: number; prefix: string; suffix: string; decimals: number };

function compactUsd(n: number): Compact {
  if (n >= 1e9) return { to: n / 1e9, prefix: '$', suffix: 'B', decimals: 2 };
  if (n >= 1e6) return { to: n / 1e6, prefix: '$', suffix: 'M', decimals: 1 };
  if (n >= 1e3) return { to: n / 1e3, prefix: '$', suffix: 'K', decimals: 0 };
  return { to: n, prefix: '$', suffix: '', decimals: 0 };
}

function Skeleton() {
  return (
    <div className="mx-auto h-9 w-24 animate-pulse rounded-md bg-white/[0.06] sm:h-10" aria-hidden />
  );
}

function Cell({
  label,
  ready,
  children,
}: {
  label: string;
  ready: boolean;
  children: React.ReactNode;
}) {
  // Solid cell bg over the gap-px container draws the divider grid at any
  // column count, so the strip reflows cleanly across breakpoints.
  return (
    <div className="flex flex-col gap-1.5 bg-[#131720] px-4 py-10 text-center">
      <div className="font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {ready ? children : <Skeleton />}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
    </div>
  );
}

export function LandingStats() {
  const { data: dailyData } = useBookDailyStats();
  const { markets, isLoading: marketsLoading } = useMarkets();
  // Unique traders from the OptionBook indexer — a real engagement signal.
  const { data: protocolStats } = useQuery({
    queryKey: ['book-protocol-stats'],
    queryFn: () => getReadClient().api.getStatsFromIndexer(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const stats = reduceDailyStats(dailyData);
  const indexerReady = !!dailyData;
  const marketsReady = !marketsLoading;
  const statsReady = typeof protocolStats?.uniqueUsers === 'number';

  const vol = compactUsd(stats.totalVolumeUsd);

  return (
    <section className="relative border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto max-w-6xl">
        {/* Honest framing: these are the underlying Thetanuts V4 OptionBook
            numbers — the liquidity Polynuts is a frontend for — not Polynuts'
            own user traction. Labelled accordingly so nothing overclaims. */}
        <p className="border-b border-white/[0.06] px-6 py-4 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
          Powered by Thetanuts V4 — the order book you&apos;re trading on
        </p>
        {/* gap-px over the divider colour draws hairlines between every cell,
            so 2-col (mobile) / 3-col (tablet) / 6-col (desktop) all stay tidy. */}
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
          <Cell label="Protocol volume" ready={indexerReady}>
            <CountUp to={vol.to} prefix={vol.prefix} suffix={vol.suffix} decimals={vol.decimals} duration={2} />
          </Cell>
          <Cell label="Options traded" ready={indexerReady}>
            <CountUp to={stats.totalTrades} duration={2} />
          </Cell>
          <Cell label="Open positions" ready={statsReady}>
            <CountUp to={protocolStats?.openPositions ?? 0} duration={2} />
          </Cell>
          <Cell label="Settled" ready={statsReady}>
            <CountUp to={protocolStats?.settledPositions ?? 0} duration={2} />
          </Cell>
          <Cell label="Live markets" ready={marketsReady}>
            <CountUp to={markets.length} duration={1.6} />
          </Cell>
          <Cell label="Traders" ready={statsReady}>
            <CountUp to={protocolStats?.uniqueUsers ?? 0} duration={1.6} />
          </Cell>
        </div>
      </div>
    </section>
  );
}
