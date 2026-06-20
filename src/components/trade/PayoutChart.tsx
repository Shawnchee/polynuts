'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketView } from '@/lib/sdk/markets';
import { getReadClient } from '@/lib/sdk/clients';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

/**
 * P/L curve visualizer — drives `client.option.simulatePayout` across 41
 * evenly-spaced settlement prices and renders the resulting net P/L
 * (payout − bet) as a two-tone area chart: green where the user profits,
 * red where they lose. Reference lines mark each strike, the spot price,
 * and the y=0 break-even line.
 *
 * Every value flows through SDK helpers — `fromPriceDecimals`,
 * `fromUsdcDecimals`, `fromStrikeDecimals` — so decimal scaling stays
 * canonical with the rest of the app.
 */

interface ChartPoint {
  priceUsd: number;
  payoutUsd: number;
  netUsd: number;
  profitNet: number;
  lossNet: number;
}

interface PayoutChartProps {
  market: MarketView;
  numContracts: bigint | null;
  betUsd: number;
}

const POINTS = 41;
const PUMP_HEX = '#16A34A';
const PUMP_FILL = 'rgba(22,163,74,0.4)';
const DUMP_HEX = '#DC2626';
const DUMP_FILL = 'rgba(220,38,38,0.4)';
const BRAND_HEX = '#2563EB';

function fmtCompactUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  }
  return `${sign}$${abs.toFixed(abs >= 10 ? 0 : 2)}`;
}

export function PayoutChart({ market, numContracts, betUsd }: PayoutChartProps) {
  // Subscribe only to the asset this chart actually renders — selecting
  // the whole `prices` object re-renders on BTC ticks while viewing ETH.
  const spot = useAppStore((s) =>
    market.asset === 'ETH'
      ? s.prices.ETH
      : market.asset === 'BTC'
      ? s.prices.BTC
      : undefined
  );

  // 41 evenly-spaced probe prices spanning 50% below lowest strike →
  // 50% above highest strike. Strikes for the simulatePayout call must
  // come from `strikesContract` (PUT family is descending) but the
  // probe-price *axis* is always ascending, so generate from strikesAsc.
  const probes = useMemo<bigint[]>(() => {
    const lo = market.strikesAsc[0];
    const hi = market.strikesAsc[market.strikesAsc.length - 1];
    const minP = (lo * 50n) / 100n;
    const maxP = (hi * 150n) / 100n;
    const span = maxP - minP;
    const out: bigint[] = [];
    for (let i = 0; i < POINTS; i++) {
      out.push(minP + (span * BigInt(i)) / BigInt(POINTS - 1));
    }
    return out;
  }, [market.strikesAsc]);

  const { data: points, isLoading } = useQuery<ChartPoint[]>({
    queryKey: [
      'payout-curve',
      market.implementation,
      market.strikesContract.map(String),
      numContracts?.toString() ?? '0',
      betUsd,
    ],
    enabled: !!numContracts && numContracts > 0n,
    queryFn: async () => {
      if (!numContracts || numContracts <= 0n) return [];
      const client = getReadClient();
      const settled = await Promise.allSettled(
        probes.map((p) =>
          client.option.simulatePayout(
            market.implementation,
            p,
            market.strikesContract,
            numContracts
          )
        )
      );
      // `simulatePayout` is a pure payoff fn; at the extreme ends of this 41-
      // point sweep the contract math reverts (CALL_EXCEPTION). Drop those
      // probe prices instead of failing the whole curve — the remaining points
      // still render a continuous line across the valid range.
      const out: ChartPoint[] = [];
      probes.forEach((p, i) => {
        const r = settled[i];
        if (r.status !== 'fulfilled') return;
        const priceUsd = Number(client.utils.fromPriceDecimals(p));
        const payoutUsd = Number(client.utils.fromUsdcDecimals(r.value));
        const netUsd = payoutUsd - betUsd;
        out.push({
          priceUsd,
          payoutUsd,
          netUsd,
          profitNet: netUsd > 0 ? netUsd : 0,
          lossNet: netUsd < 0 ? netUsd : 0,
        });
      });
      return out;
    },
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    if (!points || points.length === 0) {
      return { maxProfit: null as number | null, breakEven: null as number | null };
    }
    const maxProfit = Math.max(...points.map((pt) => pt.netUsd));
    let breakEven: number | null = null;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if ((a.netUsd <= 0 && b.netUsd > 0) || (a.netUsd >= 0 && b.netUsd < 0)) {
        const t = -a.netUsd / (b.netUsd - a.netUsd);
        breakEven = a.priceUsd + (b.priceUsd - a.priceUsd) * t;
        break;
      }
    }
    return { maxProfit, breakEven };
  }, [points]);

  const strikeUsds = useMemo(() => {
    const client = getReadClient();
    return market.strikesAsc.map((s) =>
      Number(client.utils.fromStrikeDecimals(s))
    );
  }, [market.strikesAsc]);

  if (!numContracts || numContracts <= 0n) {
    return (
      <div className="rounded-md border border-line bg-bg-subtle p-3">
        <p className="text-xs text-text-dim">Enter a bet amount to see payouts.</p>
      </div>
    );
  }

  const showSpot = typeof spot === 'number' && Number.isFinite(spot);
  const isVanilla = market.family === 'vanilla';
  const maxProfitLabel =
    stats.maxProfit == null
      ? '—'
      : isVanilla
      ? 'open-ended'
      : `+${fmtCompactUsd(stats.maxProfit)}`;
  const breakEvenLabel =
    stats.breakEven == null ? '—' : fmtCompactUsd(stats.breakEven);

  return (
    <div className="rounded-md border border-line bg-bg-subtle p-3">
      <div className="mb-2 grid grid-cols-3 gap-2">
        <Stat label="Max profit" value={maxProfitLabel} tone="pump" />
        <Stat label="Max loss" value={`-${fmtCompactUsd(betUsd)}`} tone="dump" />
        <Stat label="Break-even" value={breakEvenLabel} tone="neutral" />
      </div>

      <div className="relative h-48 w-full">
        {isLoading || !points ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgb(var(--line) / 0.4)" strokeDasharray="2 4" />
              <XAxis
                dataKey="priceUsd"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => fmtCompactUsd(v)}
                stroke="rgb(var(--text-dim))"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => fmtCompactUsd(v)}
                stroke="rgb(var(--text-dim))"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--bg-elev))',
                  border: '1px solid rgb(var(--line))',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'rgb(var(--text))',
                }}
                labelStyle={{ color: 'rgb(var(--text-muted))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'profitNet' || name === 'lossNet') {
                    return [
                      `${value >= 0 ? '+' : ''}${fmtCompactUsd(value)}`,
                      'P/L',
                    ];
                  }
                  return [fmtCompactUsd(value), name];
                }}
                labelFormatter={(label: number) =>
                  `${market.asset} @ ${fmtCompactUsd(label)}`
                }
              />
              <ReferenceLine y={0} stroke="rgb(var(--text-muted) / 0.5)" strokeWidth={1} />
              {strikeUsds.map((s, i) => (
                <ReferenceLine
                  key={`strike-${i}`}
                  x={s}
                  stroke="rgb(var(--text-dim))"
                  strokeDasharray="3 3"
                  label={{
                    value: fmtCompactUsd(s),
                    position: 'top',
                    fill: 'rgb(var(--text-dim))',
                    fontSize: 10,
                  }}
                />
              ))}
              {showSpot && (
                <ReferenceLine
                  x={spot}
                  stroke={BRAND_HEX}
                  strokeDasharray="4 2"
                  label={{
                    value: `spot ${fmtCompactUsd(spot)}`,
                    position: 'insideTopRight',
                    fill: BRAND_HEX,
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="profitNet"
                stroke={PUMP_HEX}
                strokeWidth={1.5}
                fill={PUMP_FILL}
                isAnimationActive={false}
                connectNulls={false}
                baseValue={0}
              />
              <Area
                type="monotone"
                dataKey="lossNet"
                stroke={DUMP_HEX}
                strokeWidth={1.5}
                fill={DUMP_FILL}
                isAnimationActive={false}
                connectNulls={false}
                baseValue={0}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-2 text-xs text-text-dim">
        P/L curve at expiry — green where you profit, red where you lose.
        Driven by{' '}
        <span className="num">client.option.simulatePayout</span>.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'pump' | 'dump' | 'neutral';
}) {
  return (
    <div className="rounded-md border border-line bg-bg-elev px-2 py-1.5">
      <div className="label text-text-dim">{label}</div>
      <div
        className={cn(
          'num mt-0.5 text-sm font-bold tabular-nums',
          tone === 'pump' && 'text-pump dark:text-pump-dark',
          tone === 'dump' && 'text-dump dark:text-dump-dark',
          tone === 'neutral' && 'text-text'
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-line bg-bg-elev">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent" />
    </div>
  );
}
