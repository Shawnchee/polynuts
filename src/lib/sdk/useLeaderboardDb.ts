'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser, hasSupabaseConfigClient } from '@/lib/supabase/browser';

export interface LeaderboardDbRow {
  address: string;
  total_trades: number;
  wins: number;
  /** percentage 0–100 with 2 decimals; null when no settled trades yet */
  win_rate: number | null;
  realized_pnl: number;
  last_trade_at: string | null;
}

export function useLeaderboardDb() {
  const enabled = hasSupabaseConfigClient();

  return useQuery<LeaderboardDbRow[]>({
    queryKey: ['leaderboard-db'],
    enabled,
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb
        .from('leaderboard_v')
        .select('address,total_trades,wins,win_rate,realized_pnl,last_trade_at')
        .order('realized_pnl', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LeaderboardDbRow[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
