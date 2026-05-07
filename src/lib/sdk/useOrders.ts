'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OrderWithSignature } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';
import { buildMarketView, type MarketView } from './markets';

export function useOrders() {
  const client = getReadClient();
  return useQuery<OrderWithSignature[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const orders = await client.api.fetchOrders();
      return orders;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkets(): {
  markets: MarketView[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const { data: orders, isLoading, error, refetch } = useOrders();
  const client = getReadClient();
  const config = client.chainConfig;

  const markets = useMemo(() => {
    if (!orders) return [];
    const now = Math.floor(Date.now() / 1000);
    return orders
      .filter((o) => Number(o.order.expiry) > now)
      .map((o) => buildMarketView(o, config))
      .filter((m): m is MarketView => m !== null);
  }, [orders, config]);

  return { markets, isLoading, error, refetch };
}

export function useMarketData() {
  const client = getReadClient();
  return useQuery({
    queryKey: ['marketData'],
    queryFn: async () => client.api.getMarketData(),
    refetchInterval: 5_000,
  });
}
