'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser, hasSupabaseConfigClient } from '@/lib/supabase/browser';

export interface LeaderboardDbRow {
  address: string;
  total_trades: number;
  wins: number;
  /** percentage 0–100 with 2 decimals; null when no settled trades yet */
  win_rate: number | null;
  /** total USDC premium this trader has paid across all fills (public volume) */
  total_premium: number;
  /** composite Polyscore, 0–100 = win rate + premium traded + activity (no PnL — not exposed) */
  score: number;
  last_trade_at: string | null;
}

export function useLeaderboardDb() {
  const enabled = hasSupabaseConfigClient();

  return useQuery<LeaderboardDbRow[]>({
    queryKey: ['leaderboard-db'],
    enabled,
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      // Realized PnL is not selected and is not part of the score — it is not
      // exposed on Polynuts (kept out of the public leaderboard_v view).
      const { data, error } = await sb
        .from('leaderboard_v')
        .select('address,total_trades,wins,win_rate,total_premium,score,last_trade_at')
        .order('score', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LeaderboardDbRow[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
