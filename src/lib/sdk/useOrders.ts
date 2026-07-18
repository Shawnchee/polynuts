'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OrderWithSignature } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';
import { buildMarketView, type MarketView } from './markets';
import { useAppStore } from '@/store/app';

export function useOrders() {
  const client = getReadClient();
  // Pause polling while the user is mid-trade so the book doesn't reshuffle
  // (re-sort, rotate the featured hero, swap the selected market) while
  // they're sizing or signing a bet. Resumes the instant the trade settles
  // or is cancelled.
  const tradeInProgress = useAppStore((s) => s.tradeInProgress);
  return useQuery<OrderWithSignature[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const orders = await client.api.fetchOrders();
      return orders;
    },
    refetchInterval: tradeInProgress ? false : 30_000,
  });
}

export function useMarkets(): {
  markets: MarketView[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** ms timestamp of the last successful order-book fetch (0 before first). */
  dataUpdatedAt: number;
} {
  const { data: orders, isLoading, error, refetch, dataUpdatedAt } = useOrders();
  const client = getReadClient();
  const config = client.chainConfig;

  const markets = useMemo(() => {
    if (!orders) return [];
    const now = Math.floor(Date.now() / 1000);
    const built = orders
      .filter((o) => Number(o.order.expiry) > now)
      .map((o) => buildMarketView(o, config))
      .filter((m): m is MarketView => m !== null);
    // Market ids are content-derived (see buildMarketView) and unique
    // across the live book today, but two genuinely-distinct simultaneous
    // orders sharing maker+impl+direction+strikes+expiry are not
    // structurally forbidden. Guarantee unique React keys (and a
    // deterministic selectedId -> order resolution on the money path) by
    // suffixing any repeat id within a snapshot. No-op in the observed case.
    const seen = new Map<string, number>();
    return built.map((m) => {
      const n = (seen.get(m.id) ?? 0) + 1;
      seen.set(m.id, n);
      return n === 1 ? m : { ...m, id: `${m.id}#${n}` };
    });
  }, [orders, config]);

  return { markets, isLoading, error, refetch, dataUpdatedAt };
}

export function useMarketData() {
  const client = getReadClient();
  return useQuery({
    queryKey: ['marketData'],
    queryFn: async () => client.api.getMarketData(),
    refetchInterval: 5_000,
  });
}
