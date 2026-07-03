'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { startDeribitFeed } from './deribitFeed';

/**
 * Live price wiring.
 *
 * - **Prices** stream from Deribit's public WebSocket (BTC/ETH spot index).
 *   The default Thetanuts WS endpoint (wss://ws.thetanuts.finance/v4 on
 *   chains/index.ts:260) isn't reachable from public networks. To use the
 *   SDK's `client.ws` path instead, set NEXT_PUBLIC_THETANUTS_WS_URL and
 *   pass `wsUrl` into the ThetanutsClient constructor in clients.ts.
 *
 * - **Order book** updates are picked up by React Query polling (30s in
 *   useOrders, which already pauses itself mid-trade).
 *
 * (This hook used to also poll eth_getLogs every 90s to feed a global
 * `activity` store slice — but nothing renders that slice anymore, the recent-
 * trades feed reads the DB via useRecentTradesDb, and the poller disabled
 * itself permanently on the first free-tier RPC rate-limit. That dead path was
 * removed; only the price feed remains.)
 *
 * Disconnects when the tab is hidden and reconnects on focus.
 */
export function useLiveFeed() {
  const setPrice = useAppStore((s) => s.setPrice);

  useEffect(() => {
    let feed: ReturnType<typeof startDeribitFeed> | null = null;

    function start() {
      if (!feed) {
        feed = startDeribitFeed((asset, price) => setPrice(asset, price));
      }
    }

    function stop() {
      if (feed) {
        feed.close();
        feed = null;
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
  }, [setPrice]);
}
