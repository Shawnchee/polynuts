'use client';

import { create } from 'zustand';
import type { OrderWithSignature } from '@thetanuts-finance/thetanuts-client';
import type { MarketView } from '@/lib/sdk/markets';

export type FilterTab = 'all' | 'pump' | 'dump' | 'range' | 'soon';
export type SortKey = 'volume' | 'newest' | 'soon' | 'payout';
/**
 * Polymarket-style time-to-expiry framing. Each value is a max-seconds
 * window (`expiry - now <= seconds`); 'all' disables the filter.
 */
export type TimeframeKey = 'all' | '5m' | '15m' | '30m' | '1h' | '24h';

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
  timeframe: TimeframeKey;
  selectedMarketId: string | null;
  activity: ActivityItem[];
  prices: { ETH?: number; BTC?: number };

  setFilter: (f: FilterTab) => void;
  setSort: (s: SortKey) => void;
  setTimeframe: (t: TimeframeKey) => void;
  selectMarket: (id: string | null) => void;
  prependActivity: (item: ActivityItem) => void;
  setPrice: (asset: 'ETH' | 'BTC', price: number) => void;
}

// Default to '1h' so the first-load grid is biased toward Polymarket-style
// short-dated markets (the project's product positioning per the PRD).
export const useAppStore = create<AppStore>((set) => ({
  filter: 'all',
  sort: 'soon',
  timeframe: '1h',
  selectedMarketId: null,
  activity: [],
  prices: {},

  setFilter: (f) => set({ filter: f }),
  setSort: (s) => set({ sort: s }),
  setTimeframe: (t) => set({ timeframe: t }),
  selectMarket: (id) => set({ selectedMarketId: id }),
  prependActivity: (item) =>
    set((s) => ({ activity: [item, ...s.activity].slice(0, 50) })),
  setPrice: (asset, price) =>
    set((s) => ({ prices: { ...s.prices, [asset]: price } })),
}));

const TIMEFRAME_SECONDS: Record<TimeframeKey, number | null> = {
  all: null,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
};

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
  timeframe: TimeframeKey = 'all'
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

  // Timeframe — Polymarket-style "expires within X minutes" preset
  const window = TIMEFRAME_SECONDS[timeframe];
  if (window != null) {
    const now = Math.floor(Date.now() / 1000);
    out = out.filter((m) => m.expiry - now <= window);
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
