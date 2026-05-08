'use client';

import { useMemo } from 'react';
import { TopNav } from '@/components/nav/TopNav';
import { FilterStrip } from '@/components/markets/FilterStrip';
import { MarketCard } from '@/components/markets/MarketCard';
import { Sidebar } from '@/components/markets/Sidebar';
import { TradePanel } from '@/components/trade/TradePanel';
import { useMarkets } from '@/lib/sdk/useOrders';
import { useMarketBinaryFramings } from '@/lib/sdk/usePayout';
import { useAppStore, applyFilterSort } from '@/store/app';
import { cn } from '@/lib/utils';

export default function MarketsPage() {
  const { markets, isLoading, error, refetch } = useMarkets();
  const filter = useAppStore((s) => s.filter);
  const sort = useAppStore((s) => s.sort);
  const timeframe = useAppStore((s) => s.timeframe);
  const selectedId = useAppStore((s) => s.selectedMarketId);
  const selectMarket = useAppStore((s) => s.selectMarket);

  // SDK on-chain payout sims, deduped per (impl, strikes) by React Query.
  // Drives both the highest-payout sort and the multiplier badge in cards.
  const binaries = useMarketBinaryFramings(markets);
  const multiplierByMarket = useMemo(() => {
    const m = new Map<string, number>();
    markets.forEach((mkt, i) => {
      const v = binaries[i]?.data?.multiplier;
      if (typeof v === 'number') m.set(mkt.id, v);
    });
    return m;
  }, [markets, binaries]);

  const filtered = useMemo(
    () =>
      applyFilterSort(
        markets,
        filter,
        sort,
        (m) => multiplierByMarket.get(m.id) ?? null,
        timeframe
      ),
    [markets, filter, sort, multiplierByMarket, timeframe]
  );

  const selectedMarket =
    filtered.find((m) => m.id === selectedId) ??
    markets.find((m) => m.id === selectedId) ??
    null;

  return (
    <div className="min-h-dvh">
      <TopNav active="/" />
      <FilterStrip count={filtered.length} />

      <main className="mx-auto max-w-page px-6 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="min-w-0 flex-1">
            {isLoading && <SkeletonGrid />}
            {error != null && (
              <ErrorState
                msg="Couldn't load markets — Odette API is unreachable or rate-limited."
                onRetry={() => refetch()}
              />
            )}
            {!isLoading && !error && filtered.length === 0 && <EmptyState />}
            {!isLoading && filtered.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((m, i) => (
                  <div
                    key={m.id}
                    className={cn(
                      'animate-fade-in',
                      i < 8 && `stagger-${(i % 8) + 1}`
                    )}
                  >
                    <MarketCard
                      market={m}
                      selected={selectedId === m.id}
                      onSelect={selectMarket}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[320px]">
            <div className="lg:sticky lg:top-20">
              <TradePanel market={selectedMarket} />
            </div>
            <div className="hidden lg:block">
              <Sidebar />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'relative h-44 overflow-hidden rounded-xl border border-line bg-bg-elev'
          )}
        >
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 animate-fade-in flex-col items-center justify-center rounded-xl border border-dashed border-line bg-bg-elev">
      <p className="text-md font-medium text-text">No live markets right now</p>
      <p className="mt-1 text-sm text-text-muted">
        New markets show up as makers post orders. Refreshes every 30 seconds.
      </p>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex h-64 animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-dump/40 bg-dump/5">
      <p className="text-md font-medium text-dump dark:text-dump-dark">{msg}</p>
      <button
        onClick={onRetry}
        className="press-scale rounded-md bg-dump px-4 py-2 text-sm font-semibold text-white hover:bg-dump/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
