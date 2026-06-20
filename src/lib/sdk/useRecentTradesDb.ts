'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser, hasSupabaseConfigClient } from '@/lib/supabase/browser';

export interface RecentTradeDbRow {
  tx_hash: string;
  option_id: string;
  taker_address: string;
  market_label: string | null;
  /** PUMP | DUMP | RANGE — stored loose (text) in the trades table. */
  side: string | null;
  contracts: number;
  notional_usdc: number;
  entry_price: number | null;
  created_at: string;
}

/**
 * Most-recent Polynuts fills, newest first, straight from the `trades` table
 * (anon SELECT is allowed by RLS — see migration 0001). Unlike the in-memory
 * live activity feed in useLiveFeed.ts, this is persisted and does NOT depend
 * on the rate-limited RPC `eth_getLogs` poller, so it stays populated even when
 * that poller has shut itself off on free-tier RPC.
 */
export function useRecentTradesDb(limit = 15) {
  const enabled = hasSupabaseConfigClient();

  return useQuery<RecentTradeDbRow[]>({
    queryKey: ['recent-trades-db', limit],
    enabled,
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb
        .from('trades')
        .select(
          'tx_hash,option_id,taker_address,market_label,side,contracts,notional_usdc,entry_price,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RecentTradeDbRow[];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
