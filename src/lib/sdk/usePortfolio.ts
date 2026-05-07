'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';

export function usePositions() {
  const { address } = useAccount();
  const client = getReadClient();

  return useQuery<Position[]>({
    queryKey: ['positions', address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return [];
      return client.api.getUserPositionsFromIndexer(address);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useTradeHistory() {
  const { address } = useAccount();
  const client = getReadClient();

  return useQuery<TradeHistory[]>({
    queryKey: ['tradeHistory', address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return [];
      return client.api.getUserHistoryFromIndexer(address);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
