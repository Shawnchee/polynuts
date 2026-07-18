'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';
import { stringifyWithBigint, parseWithBigint } from './bigintJson';

// ─── Last-known positions cache (localStorage) ───────────────────────────────
// The indexer call behind getUserPositionsFromIndexer() is the slowest thing on
// the portfolio page (~1-2s on the free tier), so a cold visit shows a skeleton
// for the whole wait. Persist each address's last result and feed it back as
// React Query `initialData` (stamped with its fetch time) — the page paints the
// last-known positions INSTANTLY, then RQ revalidates in the background because
// the data is already past staleTime. Scoped to positions only; any failure
// (quota, parse) just skips the cache (best-effort). Position carries bigint
// fields, so (de)serialization goes through the bigint-preserving JSON helpers.
const CACHE_PREFIX = 'pn.positions.v1.';
// Don't paint positions older than this — a fresh skeleton beats showing
// week-old (likely settled) positions for a second before revalidation.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedPositions {
  data: Position[];
  ts: number;
}

function readCache(address?: string): CachedPositions | null {
  if (typeof window === 'undefined' || !address) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + address.toLowerCase());
    if (!raw) return null;
    const parsed = parseWithBigint<CachedPositions>(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(address: string, data: Position[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CACHE_PREFIX + address.toLowerCase(),
      stringifyWithBigint({ data, ts: Date.now() } satisfies CachedPositions),
    );
  } catch {
    // Quota exceeded — skip caching.
  }
}

export function usePositions() {
  const { address } = useAccount();
  const client = getReadClient();

  // Seed initialData ONLY from a non-empty cache. Seeding `[]` would paint a
  // false "No open positions" state (isLoading=false) instead of a skeleton for
  // a user who has positions but no cache hit yet. Read once per address; safe
  // re: hydration — this query is only enabled once `address` is set (post-mount,
  // wagmi is client-only), so localStorage is available when consumed and the
  // disabled `address === undefined` query renders nothing during SSR.
  const seed = useMemo(() => {
    const cached = readCache(address);
    return cached && cached.data.length > 0 ? cached : null;
  }, [address]);

  return useQuery<Position[]>({
    queryKey: ['positions', address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return [];
      const data = await client.api.getUserPositionsFromIndexer(address);
      writeCache(address, data);
      return data;
    },
    // Paint last-known positions immediately; RQ treats them as stale (past
    // staleTime) and revalidates in the background.
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.ts,
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
