'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getReadClient } from './clients';
import { useAppStore } from '@/store/app';

/**
 * Subscribes to the Thetanuts WebSocket on mount and pumps:
 *   - PriceUpdate (ETH/BTC) → Zustand prices store
 *   - OrderUpdate (new/fill/cancel) → Zustand activity feed
 *
 * Pauses while the tab is hidden to avoid burning RPC + WS allowance.
 * Should be mounted exactly once at the app root.
 */
export function useLiveFeed() {
  const setPrice = useAppStore((s) => s.setPrice);
  const prependActivity = useAppStore((s) => s.prependActivity);
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = getReadClient();
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    async function connect() {
      try {
        await client.ws.connect();
      } catch {
        // SDK auto-reconnects; surface no UI here
        return;
      }
      if (cancelled) return;

      unsubs.push(
        client.ws.subscribePrices((u) => {
          const px = typeof u.price === 'string' ? Number(u.price) : Number(u.price);
          if (!Number.isFinite(px)) return;
          if (u.asset.startsWith('ETH')) setPrice('ETH', px);
          else if (u.asset.startsWith('BTC')) setPrice('BTC', px);
        }, 'ETH')
      );
      unsubs.push(
        client.ws.subscribePrices((u) => {
          const px = typeof u.price === 'string' ? Number(u.price) : Number(u.price);
          if (!Number.isFinite(px)) return;
          if (u.asset.startsWith('BTC')) setPrice('BTC', px);
        }, 'BTC')
      );

      unsubs.push(
        client.ws.subscribeOrders((update) => {
          if (update.event === 'fill' || update.event === 'new' || update.event === 'cancel') {
            prependActivity({
              id: `${update.orderId}-${Date.now()}`,
              ts: Date.now(),
              kind:
                update.event === 'fill'
                  ? 'filled'
                  : update.event === 'cancel'
                  ? 'cancelled'
                  : 'created',
              question:
                update.event === 'fill'
                  ? 'Bet placed'
                  : update.event === 'cancel'
                  ? 'Order cancelled'
                  : 'New market listed',
            });
            // Re-fetch order book on fills/news so cards update
            if (update.event === 'fill' || update.event === 'new') {
              queryClient.invalidateQueries({ queryKey: ['orders'] });
            }
          }
        })
      );
    }

    connect();

    function onVisibility() {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        try {
          client.ws.disconnect();
        } catch {}
      } else {
        connect();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      for (const u of unsubs) {
        try {
          u();
        } catch {}
      }
      try {
        client.ws.disconnect();
      } catch {}
    };
  }, [setPrice, prependActivity, queryClient]);
}
