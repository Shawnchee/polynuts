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

// Look back ~5 minutes (150 blocks @ 2s) for activity feed seeding.
// Smaller window = fewer eth_getLogs calls = friendlier to free-tier
// RPC plans (Alchemy free tier rate-limits log queries aggressively).
const ACTIVITY_LOOKBACK_BLOCKS = 150;
// Poll interval for the activity feed. Bumped from 30s → 90s so we don't
// hammer the RPC; the user-initiated fills still prepend instantly via
// the trade-panel's local prependActivity() call.
const ACTIVITY_POLL_MS = 90_000;

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

    // Track consecutive failures so we back off if the RPC is rate-limiting
    // (free Alchemy plans cap eth_getLogs calls per second). After 3 errors
    // we stop retrying — the user can still see their own fills via the
    // local prependActivity in the trade panel.
    let consecutiveErrors = 0;
    async function pumpRecentFills() {
      if (cancelled) return;
      if (consecutiveErrors >= 3) return;
      try {
        const client = getReadClient();
        const latest = await client.provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - ACTIVITY_LOOKBACK_BLOCKS);
        const events = await client.events.getOrderFillEvents({ fromBlock });
        consecutiveErrors = 0;
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
      } catch (err) {
        consecutiveErrors += 1;
        // Don't surface every RPC hiccup; the SDK logger already records it.
        // After the 3rd error we silently stop polling for this session.
        if (consecutiveErrors === 3) {
          // eslint-disable-next-line no-console
          console.warn(
            '[polynuts] activity feed disabled — RPC is rate-limiting. ' +
              'Upgrade NEXT_PUBLIC_RPC_URL to a paid plan or wait until tomorrow.',
            err
          );
        }
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
        // Seed the feed immediately, then poll for new fills.
        // Polling frequency tuned for Alchemy free tier — see
        // ACTIVITY_POLL_MS comment.
        pumpRecentFills();
        fillsTimer = setInterval(pumpRecentFills, ACTIVITY_POLL_MS);
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
