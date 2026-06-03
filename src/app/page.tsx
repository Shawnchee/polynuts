'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TopNav } from '@/components/nav/TopNav';
import { BottomNav } from '@/components/nav/BottomNav';
import { FilterStrip } from '@/components/markets/FilterStrip';
import { MarketCard } from '@/components/markets/MarketCard';
import { FeaturedHero } from '@/components/markets/FeaturedHero';
import { Sidebar } from '@/components/markets/Sidebar';
import { TradePanel } from '@/components/trade/TradePanel';
import { NetworkGuard } from '@/components/nav/NetworkGuard';
import { useMarkets } from '@/lib/sdk/useOrders';
import { useMarketBinaryFramings } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';
import {
  useAppStore,
  applyFilterSort,
  buildExpiryGroups,
} from '@/store/app';
import { cn } from '@/lib/utils';
import type { MarketView } from '@/lib/sdk/markets';
import type { ExpiryFilter } from '@/store/app';

const PAGE_SIZE = 18;
// Maximum markets the featured hero rotates through. Hidden when the
// filtered set has fewer than FEATURED_MIN markets — below that the
// hero slider has nothing meaningful to rotate. The previous threshold
// (`length <= 5`) hid the hero on every narrow expiry tab, which the
// user flagged as "Tomorrow has no featured section".
const FEATURED_COUNT = 10;
const FEATURED_MIN = 2;

export default function MarketsPage() {
  const { markets, isLoading, error, refetch } = useMarkets();
  const filter = useAppStore((s) => s.filter);
  const sort = useAppStore((s) => s.sort);
  const expiryFilter = useAppStore((s) => s.expiryFilter);
  const setExpiryFilter = useAppStore((s) => s.setExpiryFilter);
  const selectedId = useAppStore((s) => s.selectedMarketId);
  const selectMarket = useAppStore((s) => s.selectMarket);

  // Real expiry buckets, derived from the live order book.
  const expiryGroups = useMemo(() => buildExpiryGroups(markets), [markets]);

  // Auto-reset to 'all' if the user's selected expiry bucket has expired
  // out of the order book (e.g. the only intraday market they had filtered
  // to just settled).
  useEffect(() => {
    if (expiryFilter === 'all') return;
    const stillExists = expiryGroups.some((g) => g.ts === expiryFilter);
    if (!stillExists) setExpiryFilter('all');
  }, [expiryGroups, expiryFilter, setExpiryFilter]);

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
        expiryFilter
      ),
    [markets, filter, sort, multiplierByMarket, expiryFilter]
  );

  // Top-N featured strip — ranked by available volume × multiplier so we
  // surface markets with both real liquidity and meaningful upside.
  // Hidden when there's <= FEATURED_COUNT total or no multipliers loaded.
  // Volume + multiplier both flow from SDK paths
  // (client.utils.fromUsdcDecimals + client.option.simulatePayout); the
  // composite score formula is product-taxonomy, not a payout calculation.
  const client = getReadClient();
  const featured = useMemo(() => {
    if (filtered.length < FEATURED_MIN) return [];
    const ranked = [...filtered]
      .map((m) => {
        const vol = Number(client.utils.fromUsdcDecimals(m.availableUsdc));
        const mult = multiplierByMarket.get(m.id) ?? 0;
        return { m, score: vol * Math.max(1, Math.min(10, mult)) };
      })
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, FEATURED_COUNT).map((r) => r.m);
  }, [filtered, multiplierByMarket, client]);

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
  }, [filter, sort, expiryFilter]);

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
      <NetworkGuard />
      <FilterStrip count={filtered.length} expiryGroups={expiryGroups} />

      <main className="mx-auto max-w-page px-4 pt-6 pb-20 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="min-w-0 flex-1 space-y-6">
            {isLoading && <SkeletonGrid />}
            {error != null && (
              <ErrorState
                msg="Couldn't load markets — Odette API is unreachable or rate-limited."
                onRetry={() => refetch()}
              />
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <ExpiryEmptyState
                hasMarkets={markets.length > 0}
                onResetExpiry={() => setExpiryFilter('all')}
                expiryFilter={expiryFilter}
              />
            )}

            {!isLoading && featured.length > 0 && (
              <FeaturedHero
                markets={featured}
                selectedId={selectedId}
                onSelect={selectMarket}
                multiplierByMarket={multiplierByMarket}
              />
            )}

            {!isLoading && pageRows.length > 0 && (
              <>
                {featured.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="label text-text-muted">All markets</span>
                    <span className="num text-xs tabular-nums text-text-dim">
                      {rest.length.toLocaleString('en-US')} total
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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

          <div className="flex w-full shrink-0 flex-col gap-6 lg:w-[320px]">
            <div className="lg:sticky lg:top-20">
              <TradePanel market={selectedMarket} isLoading={isLoading} />
            </div>
            <div className="hidden lg:block">
              <Sidebar />
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
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
  // animate-pulse (no custom keyframes) per the polish spec; fixed h-44
  // reserves the real card height so there's no layout shift when markets
  // resolve. The inner blocks mirror MarketCard's structure (glyph +
  // question, CTA bar, meta strip) so the transition reads as the card
  // filling in rather than a generic box swap.
  return (
    <div
      aria-busy="true"
      aria-label="Loading markets"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex h-44 animate-pulse flex-col rounded-xl border border-line bg-bg-elev p-3"
        >
          <div className="flex items-start gap-2">
            <div className="h-6 w-6 shrink-0 rounded-md bg-bg-subtle" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-full rounded bg-bg-subtle" />
              <div className="h-3 w-2/3 rounded bg-bg-subtle" />
            </div>
          </div>
          <div className="mt-3 h-9 rounded-md bg-bg-subtle" />
          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="h-3 w-16 rounded bg-bg-subtle" />
            <div className="h-3 w-14 rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpiryEmptyState({
  hasMarkets,
  onResetExpiry,
  expiryFilter,
}: {
  hasMarkets: boolean;
  onResetExpiry: () => void;
  expiryFilter: ExpiryFilter;
}) {
  if (!hasMarkets) {
    return (
      <div className="flex h-64 animate-fade-in flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-bg-elev px-6 text-center">
        <p className="text-md font-medium text-text">No live markets right now</p>
        <p className="text-sm text-text-muted">
          New markets show up as makers post orders. This list refreshes every
          30 seconds.
        </p>
      </div>
    );
  }

  // Has markets but the user's direction × expiry combo is empty.
  return (
    <div className="flex h-64 animate-fade-in flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg-elev px-6 text-center">
      <p className="text-md font-medium text-text">
        No markets match this filter
      </p>
      <p className="text-sm text-text-muted">
        Try a different direction or expiry to see more markets.
      </p>
      {expiryFilter !== 'all' && (
        <button
          onClick={onResetExpiry}
          className="press-scale mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          Show all expiries
        </button>
      )}
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex h-64 animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-dump/40 bg-dump/5">
      <p className="text-md font-medium text-dump dark:text-dump-dark">{msg}</p>
      <button
        onClick={onRetry}
        className="press-scale rounded-md bg-dump px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dump/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dump/50"
      >
        Retry
      </button>
    </div>
  );
}
