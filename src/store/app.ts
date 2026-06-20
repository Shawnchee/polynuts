'use client';

import { create } from 'zustand';
import type { MarketView } from '@/lib/sdk/markets';

export type FilterTab = 'all' | 'pump' | 'dump' | 'range' | 'soon';
export type SortKey = 'volume' | 'newest' | 'soon' | 'payout';

/**
 * Expiry filter — either an exact unix timestamp (seconds) matching one
 * of the live order book's expiry buckets, or 'all' to disable filtering.
 *
 * Replaces the old "within X minutes" timeframe presets — the OptionBook
 * has a small set of distinct expiry timestamps (8 right now, all on the
 * 08:00 UTC cadence with one intraday) so it's clearer to filter to a
 * specific date than guess at a window.
 */
export type ExpiryFilter = number | 'all';

export interface ActivityItem {
  id: string;
  ts: number;
  kind: 'created' | 'filled' | 'cancelled';
  asset?: string;
  direction?: 'PUMP' | 'DUMP' | 'RANGE';
  question?: string;
}

interface AppStore {
  filter: FilterTab;
  sort: SortKey;
  expiryFilter: ExpiryFilter;
  selectedMarketId: string | null;
  activity: ActivityItem[];
  prices: { ETH?: number; BTC?: number };
  /**
   * True while the user is mid-trade (confirm modal open, approving, or the
   * fill is being signed/submitted). Order-book refetching is paused while
   * this is set so the markets list, featured hero, and selected market
   * don't reshuffle out from under someone who is halfway through a bet.
   */
  tradeInProgress: boolean;
  /**
   * Whether the feedback modal is open. Lifted to the store so it can be
   * triggered from two places: the floating button (desktop) and the top-nav
   * button (mobile, where the floating button is hidden to avoid overlapping
   * the bottom tab bar).
   */
  feedbackOpen: boolean;

  setFilter: (f: FilterTab) => void;
  setSort: (s: SortKey) => void;
  setExpiryFilter: (e: ExpiryFilter) => void;
  selectMarket: (id: string | null) => void;
  prependActivity: (item: ActivityItem) => void;
  setPrice: (asset: 'ETH' | 'BTC', price: number) => void;
  setTradeInProgress: (v: boolean) => void;
  setFeedbackOpen: (v: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  filter: 'all',
  sort: 'soon',
  expiryFilter: 'all',
  selectedMarketId: null,
  activity: [],
  prices: {},
  tradeInProgress: false,
  feedbackOpen: false,

  setFilter: (f) => set({ filter: f }),
  setSort: (s) => set({ sort: s }),
  setExpiryFilter: (e) => set({ expiryFilter: e }),
  selectMarket: (id) => set({ selectedMarketId: id }),
  prependActivity: (item) =>
    set((s) => ({ activity: [item, ...s.activity].slice(0, 50) })),
  setPrice: (asset, price) =>
    set((s) => ({ prices: { ...s.prices, [asset]: price } })),
  setTradeInProgress: (v) => set({ tradeInProgress: v }),
  setFeedbackOpen: (v) => set({ feedbackOpen: v }),
}));

export interface ExpiryGroup {
  /** Unix seconds of the expiry */
  ts: number;
  /** Number of markets in this bucket */
  count: number;
  /** Display label — "Today 13:00 UTC", "Tomorrow 08:00", "Sat May 10", etc. */
  label: string;
  /** Short label for chip — "Today", "Tomorrow", "May 10" */
  shortLabel: string;
}

/**
 * Group the markets array by exact expiry timestamp and produce chip
 * labels. Returns the ascending list of buckets — the page renders one
 * chip per bucket plus an "All" sentinel.
 */
export function buildExpiryGroups(markets: MarketView[]): ExpiryGroup[] {
  const counts = new Map<number, number>();
  for (const m of markets) {
    counts.set(m.expiry, (counts.get(m.expiry) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const now = Math.floor(Date.now() / 1000);
  return sorted.map(([ts, count]) => {
    const { label, shortLabel } = formatExpiryLabel(ts, now);
    return { ts, count, label, shortLabel };
  });
}

function formatExpiryLabel(
  ts: number,
  nowSec: number
): { label: string; shortLabel: string } {
  const d = new Date(ts * 1000);
  const dt = ts - nowSec;
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });

  // Same UTC calendar day → "Today HH:MM"
  const now = new Date(nowSec * 1000);
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) {
    if (dt < 60 * 60) {
      const mins = Math.floor(dt / 60);
      return { label: `Today ${time} UTC (${mins}m)`, shortLabel: `Today ${time}` };
    }
    return { label: `Today ${time} UTC`, shortLabel: `Today ${time}` };
  }

  // Tomorrow UTC
  const tomorrow = new Date(now.getTime() + 86400_000);
  const isTomorrow =
    d.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    d.getUTCMonth() === tomorrow.getUTCMonth() &&
    d.getUTCDate() === tomorrow.getUTCDate();
  if (isTomorrow) {
    return { label: `Tomorrow ${time} UTC`, shortLabel: `Tomorrow ${time}` };
  }

  // Otherwise: "Sat May 10" / longer "Sat May 10, 08:00 UTC"
  const longDate = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const shortDate = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return { label: `${longDate}, ${time} UTC`, shortLabel: shortDate };
}

/**
 * Apply user-selected filter + sort to the markets list.
 *
 * The "payout" sort needs the SDK-derived multiplier which is fetched
 * asynchronously per market via `useMarketBinaryFraming` — pass a
 * resolver that reads from the React Query cache so sorting picks up
 * the values as they land. Markets without a resolved multiplier sink
 * to the bottom (treated as 0) so the highest-payout rows come first.
 */
export function applyFilterSort(
  markets: MarketView[],
  filter: FilterTab,
  sort: SortKey,
  getMultiplier?: (m: MarketView) => number | null,
  expiryFilter: ExpiryFilter = 'all'
): MarketView[] {
  let out = [...markets];

  // Direction filter
  if (filter === 'pump') out = out.filter((m) => m.direction === 'PUMP');
  else if (filter === 'dump') out = out.filter((m) => m.direction === 'DUMP');
  else if (filter === 'range') out = out.filter((m) => m.direction === 'RANGE');
  else if (filter === 'soon') {
    const cutoff = Math.floor(Date.now() / 1000) + 24 * 3600;
    out = out.filter((m) => m.expiry < cutoff);
  }

  // Expiry filter — exact-match against a real bucket on the order book
  if (expiryFilter !== 'all') {
    out = out.filter((m) => m.expiry === expiryFilter);
  }

  switch (sort) {
    case 'volume':
      out.sort((a, b) =>
        a.availableUsdc > b.availableUsdc ? -1 : a.availableUsdc < b.availableUsdc ? 1 : 0
      );
      break;
    case 'newest':
      out.sort((a, b) => Number(b.order.order.nonce - a.order.order.nonce));
      break;
    case 'soon':
      out.sort((a, b) => a.expiry - b.expiry);
      break;
    case 'payout':
      out.sort(
        (a, b) => (getMultiplier?.(b) ?? 0) - (getMultiplier?.(a) ?? 0)
      );
      break;
  }

  return out;
}
