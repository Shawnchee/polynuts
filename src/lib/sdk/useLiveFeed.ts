'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app';
import { getReadClient } from './clients';
import { startDeribitFeed } from './deribitFeed';

/**
 * Live price + market refresh wiring.
 *
 * - **Prices** stream from Deribit's public WebSocket (BTC/ETH spot index).
 *   The default Thetanuts WS endpoint (wss://ws.thetanuts.finance/v4 on
 *   chains/index.ts:260) isn't reachable from public networks. To use the
 *   SDK's `client.ws` path instead, set NEXT_PUBLIC_THETANUTS_WS_URL and
 *   pass `wsUrl` into the ThetanutsClient constructor in clients.ts.
 *
 * - **Order book** updates are picked up by React Query polling (30s in
 *   useOrders) plus an additional 30s invalidate from this hook so new
 *   markets surface promptly.
 *
 * - **Activity feed** is hydrated on mount with recent on-chain
 *   OrderFill events via `client.events.getOrderFillEvents`, then kept
 *   live by polling for new fills every 30s.
 *
 * Disconnects when the tab is hidden and reconnects on focus.
 */

// Look back ~15 minutes (450 blocks @ 2s) for activity feed seeding —
// stays well under the SDK's 100K-block chunked cap and shows fills
// recent enough to feel "live" without flooding the feed.
const ACTIVITY_LOOKBACK_BLOCKS = 450;

export function useLiveFeed() {
  const setPrice = useAppStore((s) => s.setPrice);
  const prependActivity = useAppStore((s) => s.prependActivity);
  const queryClient = useQueryClient();
  // Track last-seen tx hashes so we don't re-add the same fill on each poll
  const seenTxsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let feed: ReturnType<typeof startDeribitFeed> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let fillsTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function pumpRecentFills() {
      if (cancelled) return;
      try {
        const client = getReadClient();
        const latest = await client.provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - ACTIVITY_LOOKBACK_BLOCKS);
        const events = await client.events.getOrderFillEvents({ fromBlock });
        // Newest first; cap to reasonable feed length
        const sorted = [...events]
          .sort((a, b) =>
            b.blockNumber !== a.blockNumber
              ? b.blockNumber - a.blockNumber
              : b.logIndex - a.logIndex
          )
          .slice(0, 30);
        for (const ev of sorted) {
          const id = `${ev.transactionHash}-${ev.logIndex}`;
          if (seenTxsRef.current.has(id)) continue;
          seenTxsRef.current.add(id);
          prependActivity({
            id,
            ts: Date.now(),
            kind: 'filled',
            question: `Fill — taker ${ev.taker.slice(0, 6)}…${ev.taker.slice(-4)}`,
          });
        }
      } catch {
        // RPC hiccup, retry next tick
      }
    }

    function start() {
      if (!feed) {
        feed = startDeribitFeed((asset, price) => setPrice(asset, price));
      }
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 30_000);
      }
      if (!fillsTimer) {
        // Seed the feed immediately, then poll for new fills
        pumpRecentFills();
        fillsTimer = setInterval(pumpRecentFills, 30_000);
      }
    }

    function stop() {
      if (feed) {
        feed.close();
        feed = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (fillsTimer) {
        clearInterval(fillsTimer);
        fillsTimer = null;
      }
    }

    function onVisibility() {
      if (typeof document === 'undefined') return;
      if (document.hidden) stop();
      else start();
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [setPrice, prependActivity, queryClient]);
}
