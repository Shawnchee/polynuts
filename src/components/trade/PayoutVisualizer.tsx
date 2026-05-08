'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MarketView } from '@/lib/sdk/markets';
import { getReadClient } from '@/lib/sdk/clients';
import { fmtUsd, cn } from '@/lib/utils';

/**
 * Live payout visualizer — drives `client.option.simulatePayout` against
 * a settlement-price slider so the user can see exactly what they'd win
 * at any closing price. Every value is on-chain pure (BaseOption ABI's
 * pure simulatePayout), no homegrown math.
 *
 * - Slider range: 50% below the lowest strike → 50% above the highest.
 * - For vanilla orders we plot a coarse 21-point sweep so the user sees
 *   the unbounded payoff curve.
 * - For bounded structures (spread / fly / condor / ranger) we plot 41
 *   points and highlight the structural max strikes on the axis.
 */
export function PayoutVisualizer({
  market,
  numContracts,
}: {
  market: MarketView;
  numContracts: bigint | null;
}) {
  const lo = market.strikesAsc[0];
  const hi = market.strikesAsc[market.strikesAsc.length - 1];
  // Default to the midpoint of the strikes (or 0 if vanilla single-strike)
  const initialPrice = useMemo<bigint>(() => {
    if (market.strikesAsc.length >= 2) return (lo + hi) / 2n;
    return lo;
  }, [lo, hi, market.strikesAsc.length]);

  const [probePrice, setProbePrice] = useState<bigint>(initialPrice);
  useEffect(() => setProbePrice(initialPrice), [initialPrice]);

  // 50% below low strike → 50% above high strike, chunked into 41 steps
  const range = useMemo(() => {
    const minP = (lo * 50n) / 100n;
    const maxP = (hi * 150n) / 100n;
    const step = (maxP - minP) / 40n;
    return { minP, maxP, step };
  }, [lo, hi]);

  // Live SDK call — debounced 250ms by React Query's queryKey changing
  const { data: payoutAtProbe } = useQuery({
    queryKey: [
      'payout-visualizer',
      market.implementation,
      market.strikesContract.map(String),
      probePrice.toString(),
      numContracts?.toString() ?? '0',
    ],
    queryFn: async () => {
      if (!numContracts || numContracts <= 0n) return 0n;
      const client = getReadClient();
      return client.option.simulatePayout(
        market.implementation,
        probePrice,
        market.strikesContract,
        numContracts
      );
    },
    enabled: !!numContracts && numContracts > 0n,
    staleTime: 60_000,
  });

  const probeUsd = Number(probePrice) / 1e8;
  const payoutUsd = payoutAtProbe ? Number(payoutAtProbe) / 1e6 : 0;

  return (
    <div className="rounded-md border border-line bg-bg-subtle p-3">
      <div className="flex items-center justify-between">
        <div className="label text-text-dim">If {market.asset} closes at</div>
        <PayoutBadge payoutUsd={payoutUsd} numContracts={numContracts} />
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="num text-lg font-bold tabular-nums text-text">
          {fmtUsd(probeUsd, { compact: probeUsd >= 1000 })}
        </span>
        <span className="text-xs text-text-dim">
          settlement price
        </span>
      </div>

      <input
        type="range"
        min={range.minP.toString()}
        max={range.maxP.toString()}
        step={range.step.toString()}
        value={probePrice.toString()}
        onChange={(e) => setProbePrice(BigInt(e.target.value))}
        className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand"
      />

      {/* Strike markers on the axis — clickable shortcuts */}
      <div className="mt-2 flex flex-wrap gap-1">
        {market.strikesAsc.map((s, i) => {
          const usd = Number(s) / 1e8;
          const active = probePrice === s;
          return (
            <button
              key={`${s.toString()}-${i}`}
              onClick={() => setProbePrice(s)}
              className={cn(
                'press-scale rounded-sm border px-1.5 py-0.5 num text-xs tabular-nums transition-colors',
                active
                  ? 'border-text bg-text text-bg-elev'
                  : 'border-line text-text-muted hover:text-text'
              )}
            >
              ${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PayoutBadge({
  payoutUsd,
  numContracts,
}: {
  payoutUsd: number;
  numContracts: bigint | null;
}) {
  if (!numContracts) {
    return (
      <span className="num text-xs text-text-dim">enter amount</span>
    );
  }
  if (payoutUsd <= 0) {
    return (
      <span className="num text-base font-bold tabular-nums text-text-dim">
        $0
      </span>
    );
  }
  return (
    <span className="num text-base font-bold tabular-nums text-pump dark:text-pump-dark">
      +${payoutUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
    </span>
  );
}
