'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { TopNav } from '@/components/nav/TopNav';
import { FilterStrip } from '@/components/markets/FilterStrip';
import { MarketCard } from '@/components/markets/MarketCard';
import { Sidebar } from '@/components/markets/Sidebar';
import { TradePanel } from '@/components/trade/TradePanel';
import { useMarkets } from '@/lib/sdk/useOrders';
import { useMarketBinaryFramings } from '@/lib/sdk/usePayout';
import { useAppStore, applyFilterSort } from '@/store/app';
import { cn } from '@/lib/utils';
import type { MarketView } from '@/lib/sdk/markets';

const PAGE_SIZE = 18;
const FEATURED_COUNT = 5;

export default function MarketsPage() {
  const { markets, isLoading, error, refetch } = useMarkets();
  const filter = useAppStore((s) => s.filter);
  const sort = useAppStore((s) => s.sort);
  const timeframe = useAppStore((s) => s.timeframe);
  const selectedId = useAppStore((s) => s.selectedMarketId);
  const selectMarket = useAppStore((s) => s.selectMarket);

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

  // Top-N featured strip — ranked by available volume × multiplier so we
  // surface markets with both real liquidity and meaningful upside.
  // Hidden when there's <= FEATURED_COUNT total or no multipliers loaded.
  const featured = useMemo(() => {
    if (filtered.length <= FEATURED_COUNT) return [];
    const ranked = [...filtered]
      .map((m) => {
        const vol = Number(m.availableUsdc) / 1e6;
        const mult = multiplierByMarket.get(m.id) ?? 0;
        return { m, score: vol * Math.max(1, Math.min(10, mult)) };
      })
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, FEATURED_COUNT).map((r) => r.m);
  }, [filtered, multiplierByMarket]);

  const featuredIds = useMemo(
    () => new Set(featured.map((m) => m.id)),
    [featured]
  );
  const rest = useMemo(
    () => filtered.filter((m) => !featuredIds.has(m.id)),
    [filtered, featuredIds]
  );

  // Pagination on the rest. Reset to page 1 whenever the filter scope
  // changes so the user always lands on a populated page.
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [filter, sort, timeframe]);

  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = rest.slice(pageStart, pageStart + PAGE_SIZE);

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
          <section className="min-w-0 flex-1 space-y-6">
            {isLoading && <SkeletonGrid />}
            {error != null && (
              <ErrorState
                msg="Couldn't load markets — Odette API is unreachable or rate-limited."
                onRetry={() => refetch()}
              />
            )}
            {!isLoading && !error && filtered.length === 0 && <EmptyState />}

            {!isLoading && featured.length > 0 && (
              <FeaturedStrip
                markets={featured}
                selectedId={selectedId}
                onSelect={selectMarket}
              />
            )}

            {!isLoading && pageRows.length > 0 && (
              <>
                {featured.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="label text-text-muted">All markets</span>
                    <span className="num text-xs text-text-dim">
                      {rest.length} total
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {pageRows.map((m, i) => (
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
                {totalPages > 1 && (
                  <Pager
                    page={safePage}
                    totalPages={totalPages}
                    onPage={setPage}
                  />
                )}
              </>
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

function FeaturedStrip({
  markets,
  selectedId,
  onSelect,
}: {
  markets: MarketView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-gold" aria-hidden />
        <span className="label text-gold">Hot Markets</span>
        <span className="text-xs text-text-dim">
          · highest volume × payout right now
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {markets.map((m, i) => (
          <div
            key={m.id}
            className={cn('animate-fade-in', `stagger-${(i % 5) + 1}`)}
          >
            <MarketCard
              market={m}
              selected={selectedId === m.id}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
        className={cn(
          'press-scale inline-flex h-9 items-center gap-1 rounded-md border border-line bg-bg-elev px-3 text-sm text-text transition-colors',
          'hover:bg-surface-hover',
          page <= 1 && 'cursor-not-allowed opacity-50'
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </button>
      <span className="num text-sm tabular-nums text-text-muted">
        Page <span className="font-semibold text-text">{page}</span> of{' '}
        <span className="font-semibold text-text">{totalPages}</span>
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Next page"
        className={cn(
          'press-scale inline-flex h-9 items-center gap-1 rounded-md border border-line bg-bg-elev px-3 text-sm text-text transition-colors',
          'hover:bg-surface-hover',
          page >= totalPages && 'cursor-not-allowed opacity-50'
        )}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
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
