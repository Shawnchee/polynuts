'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Position } from '@thetanuts-finance/thetanuts-client';
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

// The user's trade HISTORY is no longer read from the indexer here — it is
// served exclusively from our own DB via useTradeHistoryDb (Polynuts trades
// only, consistent with the leaderboard). The indexer remains the server-side
// sync SOURCE that populates that DB (see lib/supabase/sync.ts), not a browser
// read path. Open positions above stay on the indexer: the DB doesn't track a
// live position's streaming mark.
