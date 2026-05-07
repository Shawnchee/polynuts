'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app';
import { startDeribitFeed } from './deribitFeed';

/**
 * Live price + market refresh wiring.
 *
 * - **Prices** stream from Deribit's public WebSocket (BTC/ETH spot index).
 *   The Thetanuts WS endpoint isn't deployed publicly; we don't try to
 *   connect to it.
 * - **Order book** updates are picked up by React Query polling (30s in
 *   useOrders). We additionally invalidate every 30s when the tab is
 *   visible so newly-listed markets surface promptly.
 *
 * The Deribit socket disconnects when the tab is hidden and reconnects on
 * focus, to avoid burning their public-feed budget.
 */
export function useLiveFeed() {
  const setPrice = useAppStore((s) => s.setPrice);
  const queryClient = useQueryClient();

  useEffect(() => {
    let feed: ReturnType<typeof startDeribitFeed> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (!feed) {
        feed = startDeribitFeed((asset, price) => {
          setPrice(asset, price);
        });
      }
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 30_000);
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
    }

    function onVisibility() {
      if (typeof document === 'undefined') return;
      if (document.hidden) stop();
      else start();
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [setPrice, queryClient]);
}
