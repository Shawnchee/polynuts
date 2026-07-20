'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TopNav } from '@/components/nav/TopNav';
import { BottomNav } from '@/components/nav/BottomNav';
import { FilterStrip } from '@/components/markets/FilterStrip';
import { MarketCard } from '@/components/markets/MarketCard';
import { FeaturedHero } from '@/components/markets/FeaturedHero';
import { MarketTicker } from '@/components/markets/MarketTicker';
import { TradeDrawer } from '@/components/trade/TradeDrawer';
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

// 20 divides evenly into the 2/4/5-column breakpoints so pages don't end on a
// ragged partial row on wide screens (the grid is full-width now).
const PAGE_SIZE = 20;
// Maximum markets the featured hero rotates through. Hidden when the
// filtered set has fewer than FEATURED_MIN markets — below that the
// hero slider has nothing meaningful to rotate. The previous threshold
// (`length <= 5`) hid the hero on every narrow expiry tab, which the
// user flagged as "Tomorrow has no featured section".
const FEATURED_COUNT = 10;
const FEATURED_MIN = 2;

export default function MarketsPage() {
  const { markets, isLoading, error, refetch, dataUpdatedAt } = useMarkets();
  const filter = useAppStore((s) => s.filter);
  const sort = useAppStore((s) => s.sort);
  const expiryFilter = useAppStore((s) => s.expiryFilter);
  const setExpiryFilter = useAppStore((s) => s.setExpiryFilter);
  const selectedId = useAppStore((s) => s.selectedMarketId);
  const selectMarket = useAppStore((s) => s.selectMarket);

  // Selecting a market opens the trade drawer (a focused overlay), so there's
  // no off-screen sticky panel to scroll into view any more — just set the
  // selection and the drawer slides in.
  const selectAndReveal = useCallback(
    (id: string | null) => selectMarket(id),
    [selectMarket]
  );

  // Deep-link selection — the landing "Trade these right now" rows link to
  // /markets?m=<marketId>. Apply it once the order book has loaded so the
  // clicked market opens straight in the trade drawer. Guarded by a ref so a
  // background refetch never re-snaps the user back to the deep-linked market
  // after they've picked something else.
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || markets.length === 0) return;
    if (typeof window === 'undefined') return;
    const wanted = new URLSearchParams(window.location.search).get('m');
    if (!wanted) {
      deepLinkApplied.current = true;
      return;
    }
    const hit = markets.find((m) => m.id === wanted);
    if (hit) {
      selectMarket(hit.id);
      deepLinkApplied.current = true;
    }
  }, [markets, selectMarket]);

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

  // Signature of the featured INPUT that should trigger a re-rank: the market
  // SET plus whether each market has a resolved multiplier yet. It intentionally
  // excludes the multiplier VALUE and availableUsdc, both of which tick every
  // 30s poll. `multiplierByMarket.has(id)` only flips false->true once (on first
  // resolve; keepPreviousData holds it thereafter), so a value tick never changes
  // the signature — but a new listing, an expiry, a filter/expiry-scope change,
  // or a first multiplier resolve all do.
  const featuredSig = useMemo(() => {
    if (filtered.length < FEATURED_MIN) return '';
    return filtered
      .map((m) => `${m.id}:${multiplierByMarket.has(m.id) ? 1 : 0}`)
      .sort()
      .join('|');
  }, [filtered, multiplierByMarket]);

  // Frozen ranked membership: recompute the top-N featured id list ONLY when
  // featuredSig changes (market set / first-multiplier-resolve), never on a
  // pure value tick — that boundary re-ranking was reshuffling `rest` and the
  // page-1 slice. Keyed on featuredSig alone; filtered/multiplierByMarket are
  // read for their latest values by design, so an unchanged signature reuses
  // the previous list (no cross-render ref needed).
  const featuredIdList = useMemo(() => {
    if (filtered.length < FEATURED_MIN) return [] as string[];
    return [...filtered]
      .map((m) => {
        const vol = Number(client.utils.fromUsdcDecimals(m.availableUsdc));
        const mult = multiplierByMarket.get(m.id) ?? 0;
        return { id: m.id, score: vol * Math.max(1, Math.min(10, mult)) };
      })
      // Final id tiebreak so an exact score tie ranks deterministically
      // between recomputes.
      .sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      )
      .slice(0, FEATURED_COUNT)
      .map((r) => r.id);
    // Keyed on featuredSig only, on purpose: re-ranking on every value tick is
    // exactly the churn being fixed. featuredSig already changes whenever the
    // market set or a first-multiplier-resolve changes — i.e. when we must
    // re-rank — so reading the latest filtered/multiplier here is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredSig]);

  // Resolve the frozen ids back to CURRENT market objects so displayed values
  // stay live; only membership + order are frozen between signature changes.
  const featured = useMemo(() => {
    const byId = new Map(filtered.map((m) => [m.id, m] as const));
    return featuredIdList
      .map((id) => byId.get(id))
      .filter((m): m is MarketView => m != null);
  }, [filtered, featuredIdList]);

  const featuredIds = useMemo(
    () => new Set(featured.map((m) => m.id)),
    [featured]
  );
  // When the whole filtered set fits inside the featured hero, subtracting the
  // featured markets leaves an empty grid — clicking a narrow expiry like
  // "Today 10:00" showed only the rotating hero with a blank list beneath it,
  // which reads as "nothing loaded". In that case show the full filtered set in
  // the grid; the hero just highlights the top few on top of the same list.
  const rest = useMemo(
    () =>
      filtered.length <= FEATURED_COUNT
        ? filtered
        : filtered.filter((m) => !featuredIds.has(m.id)),
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

  // Entrance animation plays only on the list's FIRST paint. After the initial
  // stagger completes, later polls must not restage the grid: a card that
  // legitimately enters just appears, and a market oscillating across the page
  // boundary can't strobe. SSR-safe — starts false on server AND client (so the
  // rendered class string matches during hydration), flips only client-side.
  const listReady = !isLoading && pageRows.length > 0;
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    if (!listReady || entranceDone) return;
    // 240ms max stagger + 280ms fade = 520ms; wait past it so the initial
    // animation finishes before we stop applying the classes.
    const id = setTimeout(() => setEntranceDone(true), 600);
    return () => clearTimeout(id);
  }, [listReady, entranceDone]);

  const selectedMarket =
    filtered.find((m) => m.id === selectedId) ??
    markets.find((m) => m.id === selectedId) ??
    null;

  return (
    <div className="min-h-dvh">
      <TopNav active="/markets" />
      <NetworkGuard />
      <FilterStrip count={filtered.length} expiryGroups={expiryGroups} />
      <MarketTicker />

      <main className="mx-auto max-w-page space-y-6 px-4 pt-6 pb-20 sm:px-6 sm:pb-6">
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
            onSelect={selectAndReveal}
            multiplierByMarket={multiplierByMarket}
          />
        )}

        {!isLoading && pageRows.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="label text-text-muted">
                {featured.length > 0 ? 'All markets' : 'Markets'}
              </span>
              <div className="flex items-center gap-3">
                <QuotesFreshness updatedAt={dataUpdatedAt} />
                <span className="num text-xs tabular-nums text-text-dim">
                  {rest.length.toLocaleString('en-US')} total
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {pageRows.map((m, i) => (
                <div
                  key={m.id}
                  className={cn(
                    !entranceDone && 'animate-fade-in',
                    !entranceDone && i < 8 && `stagger-${(i % 8) + 1}`
                  )}
                >
                  <MarketCard
                    market={m}
                    selected={selectedId === m.id}
                    onSelect={selectAndReveal}
                  />
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <Pager page={safePage} totalPages={totalPages} onPage={setPage} />
            )}
          </>
        )}
      </main>

      <TradeDrawer
        market={selectedMarket}
        isLoading={isLoading}
        onClose={() => selectMarket(null)}
      />
      <BottomNav />
    </div>
  );
}

/**
 * Subtle freshness indicator for the order book. The grid auto-refreshes every
 * 30s (paused mid-trade); this gives passive awareness that quotes are live and
 * briefly highlights green when a fresh book lands — no toast spam while
 * browsing. The explicit "quotes updated, retry" toast only fires at the trade
 * moment, when a fill fails on a stale quote (see TradePanel).
 */
function QuotesFreshness({ updatedAt }: { updatedAt: number }) {
  const [, force] = useState(0);
  const [flash, setFlash] = useState(false);
  const first = useRef(true);

  // Keep the relative "updated Ns ago" label roughly current.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  // Brief green highlight whenever a newer book lands (updatedAt advances).
  // Skip the first mount so it doesn't flash on initial load.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 1_200);
    return () => clearTimeout(id);
  }, [updatedAt]);

  if (!updatedAt) return null;
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  const ago =
    secs < 5 ? 'just now' : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;

  return (
    <span
      title="The order book refreshes every 30 seconds"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs tabular-nums transition-colors duration-500',
        flash ? 'text-pump dark:text-pump-dark' : 'text-text-dim'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-colors duration-500',
          flash ? 'bg-pump dark:bg-pump-dark' : 'bg-text-dim'
        )}
      />
      Quotes updated {ago}
    </span>
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
