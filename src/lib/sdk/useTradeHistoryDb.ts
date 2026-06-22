'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { hasSupabaseConfigClient } from '@/lib/supabase/browser';

export interface DbTradeRow {
  id: number;
  tx_hash: string;
  option_id: string;
  market_label: string | null;
  /** PUMP | DUMP | RANGE | null */
  side: string | null;
  contracts: number;
  notional_usdc: number;
  entry_price: number | null;
  created_at: string;
  settle_price: number | null;
  payout_usdc: number | null;
  pnl_usdc: number | null;
  is_win: boolean | null;
  settled_at: string | null;
  /** On-chain payout (close) tx hash — Basescan proof the buyer was paid. */
  settle_tx_hash: string | null;
}

interface ApiResponse {
  rows: DbTradeRow[];
  synced: { tradesUpserted: number; settlementsUpserted: number } | null;
  syncError: string | null;
}

export function dbBacked(): boolean {
  return hasSupabaseConfigClient();
}

export function useTradeHistoryDb() {
  const { address } = useAccount();
  const enabled = !!address && dbBacked();

  return useQuery<DbTradeRow[]>({
    queryKey: ['me-trades', address?.toLowerCase()],
    enabled,
    queryFn: async () => {
      if (!address) return [];
      const r = await fetch(`/api/me/trades?address=${address}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `failed: ${r.status}`);
      }
      const body = (await r.json()) as ApiResponse;
      return body.rows;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
