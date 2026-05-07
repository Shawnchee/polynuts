'use client';

import { create } from 'zustand';
import type { OrderWithSignature } from '@thetanuts-finance/thetanuts-client';
import type { MarketView } from '@/lib/sdk/markets';

export type FilterTab = 'all' | 'pump' | 'dump' | 'range' | 'soon';
export type SortKey = 'volume' | 'newest' | 'soon' | 'payout';

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
  selectedMarketId: string | null;
  activity: ActivityItem[];
  prices: { ETH?: number; BTC?: number };

  setFilter: (f: FilterTab) => void;
  setSort: (s: SortKey) => void;
  selectMarket: (id: string | null) => void;
  prependActivity: (item: ActivityItem) => void;
  setPrice: (asset: 'ETH' | 'BTC', price: number) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  filter: 'all',
  sort: 'volume',
  selectedMarketId: null,
  activity: [],
  prices: {},

  setFilter: (f) => set({ filter: f }),
  setSort: (s) => set({ sort: s }),
  selectMarket: (id) => set({ selectedMarketId: id }),
  prependActivity: (item) =>
    set((s) => ({ activity: [item, ...s.activity].slice(0, 50) })),
  setPrice: (asset, price) =>
    set((s) => ({ prices: { ...s.prices, [asset]: price } })),
}));

export function applyFilterSort(
  markets: MarketView[],
  filter: FilterTab,
  sort: SortKey
): MarketView[] {
  let out = [...markets];

  if (filter === 'pump') out = out.filter((m) => m.direction === 'PUMP');
  else if (filter === 'dump') out = out.filter((m) => m.direction === 'DUMP');
  else if (filter === 'range') out = out.filter((m) => m.direction === 'RANGE');
  else if (filter === 'soon') {
    const cutoff = Math.floor(Date.now() / 1000) + 24 * 3600;
    out = out.filter((m) => m.expiry < cutoff);
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
      out.sort((a, b) => b.multiplier - a.multiplier);
      break;
  }

  return out;
}
