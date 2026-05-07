'use client';

import { useMemo } from 'react';
import { TopNav } from '@/components/nav/TopNav';
import { FilterStrip } from '@/components/markets/FilterStrip';
import { MarketCard } from '@/components/markets/MarketCard';
import { Sidebar } from '@/components/markets/Sidebar';
import { useMarkets } from '@/lib/sdk/useOrders';
import { useAppStore, applyFilterSort } from '@/store/app';

export default function MarketsPage() {
  const { markets, isLoading, error, refetch } = useMarkets();
  const filter = useAppStore((s) => s.filter);
  const sort = useAppStore((s) => s.sort);
  const selectedId = useAppStore((s) => s.selectedMarketId);
  const selectMarket = useAppStore((s) => s.selectMarket);

  const filtered = useMemo(
    () => applyFilterSort(markets, filter, sort),
    [markets, filter, sort]
  );

  return (
    <div className="min-h-screen bg-ink-50">
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
                {filtered.map((m) => (
                  <MarketCard
                    key={m.id}
                    market={m}
                    selected={selectedId === m.id}
                    onSelect={selectMarket}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="hidden w-[300px] shrink-0 lg:block">
            <Sidebar />
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
          className="h-44 animate-pulse rounded-lg border border-ink-200 bg-white"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 bg-white">
      <p className="text-md font-medium text-ink-900">No live markets right now</p>
      <p className="mt-1 text-sm text-ink-600">
        New markets show up as makers post orders. Refreshes every 30 seconds.
      </p>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-dump-border bg-dump-light">
      <p className="text-md font-medium text-dump">{msg}</p>
      <button
        onClick={onRetry}
        className="rounded-md bg-dump px-4 py-2 text-sm font-semibold text-white hover:bg-dump/90"
      >
        Retry
      </button>
    </div>
  );
}
