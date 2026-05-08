'use client';

import { create } from 'zustand';
import type { OrderWithSignature } from '@thetanuts-finance/thetanuts-client';
import type { MarketView } from '@/lib/sdk/markets';

export type FilterTab = 'all' | 'pump' | 'dump' | 'range' | 'soon';
export type SortKey = 'volume' | 'newest' | 'soon' | 'payout';
/**
 * Time-to-expiry framing. Each value is a max-seconds window
 * (`expiry - now <= seconds`); 'all' disables the filter.
 *
 * Polymarket-style short windows (5m/15m/30m/1h) are kept for when
 * makers post intraday options — the OptionBook commonly has these
 * earlier in the day but they often clear before settlement, leaving
 * 24h+ markets only. Realistic defaults land on 24h so first-load
 * isn't empty.
 */
export type TimeframeKey =
  | 'all'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '24h'
  | '3d'
  | '7d';

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

// Default to '24h' since the OptionBook's shortest-dated markets are
// usually 24h+ at any given moment. Sub-1h chips still render so the
// user can dial in tighter when intraday options are listed.
export const useAppStore = create<AppStore>((set) => ({
  filter: 'all',
  sort: 'soon',
  timeframe: '24h',
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

export const TIMEFRAME_SECONDS: Record<TimeframeKey, number | null> = {
  all: null,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '3d': 3 * 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
};

/** Ascending order — for fallback "what's the smallest window that has markets". */
export const TIMEFRAME_ORDER: TimeframeKey[] = [
  '5m',
  '15m',
  '30m',
  '1h',
  '24h',
  '3d',
  '7d',
  'all',
];

/**
 * Find the smallest timeframe window strictly larger than `from` that
 * contains at least one market. Returns null if even 'all' is empty.
 *
 * Used by the empty-state CTA: if the user picked 5m and got 0 markets,
 * tell them "soonest is 1h 4m — try 24h" with an auto-jump button.
 */
export function suggestNextTimeframe(
  markets: MarketView[],
  from: TimeframeKey
): { timeframe: TimeframeKey; count: number } | null {
  if (markets.length === 0) return null;
  const fromIdx = TIMEFRAME_ORDER.indexOf(from);
  const now = Math.floor(Date.now() / 1000);
  for (let i = fromIdx + 1; i < TIMEFRAME_ORDER.length; i++) {
    const tf = TIMEFRAME_ORDER[i];
    const win = TIMEFRAME_SECONDS[tf];
    const count =
      win == null
        ? markets.length
        : markets.filter((m) => m.expiry - now <= win).length;
    if (count > 0) return { timeframe: tf, count };
  }
  return null;
}

/** Soonest expiry across the markets list, returned as a "in Xh Ym" label. */
export function describeSoonestExpiry(markets: MarketView[]): string | null {
  if (markets.length === 0) return null;
  const now = Math.floor(Date.now() / 1000);
  let soonest = Infinity;
  for (const m of markets) {
    const dt = m.expiry - now;
    if (dt > 0 && dt < soonest) soonest = dt;
  }
  if (!Number.isFinite(soonest)) return null;
  const hours = Math.floor(soonest / 3600);
  const mins = Math.floor((soonest % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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
