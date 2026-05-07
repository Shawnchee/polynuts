'use client';

/**
 * Deribit public WebSocket — live BTC + ETH spot index ticks.
 *
 * The Thetanuts SDK ships a WS module that points at an unreachable URL
 * (`wss://ws.thetanuts.finance/v4`) so we run our own price feed off
 * Deribit's public market-data WS. No auth required, free, well-documented.
 *
 * Channel: `deribit_price_index.{btc_usd,eth_usd}` — combined-exchange
 * spot index (the same feed Deribit settles options against). Index
 * updates roughly every second on price change.
 *
 * Refs:
 *   docs.deribit.com/v2/#deribit-price-index-channel
 *   insights.deribit.com — heartbeat / connection guidance
 */

const DERIBIT_WS_URL = 'wss://www.deribit.com/ws/api/v2';

const HEARTBEAT_INTERVAL_S = 30; // server pings client every N seconds
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export type Asset = 'ETH' | 'BTC';

type PriceHandler = (asset: Asset, price: number) => void;

interface FeedHandle {
  close: () => void;
}

export function startDeribitFeed(onPrice: PriceHandler): FeedHandle {
  if (typeof window === 'undefined') return { close: () => {} };

  let ws: WebSocket | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let nextRpcId = 1;

  function connect() {
    if (stopped) return;
    try {
      ws = new WebSocket(DERIBIT_WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      attempt = 0;
      // 1) subscribe to both indices in one frame
      ws?.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: nextRpcId++,
          method: 'public/subscribe',
          params: {
            channels: ['deribit_price_index.btc_usd', 'deribit_price_index.eth_usd'],
          },
        })
      );
      // 2) ask the server to keep the connection alive — REQUIRED, otherwise
      //    Deribit will close idle sockets. We respond to test_request below.
      ws?.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: nextRpcId++,
          method: 'public/set_heartbeat',
          params: { interval: HEARTBEAT_INTERVAL_S },
        })
      );
    });

    ws.addEventListener('message', (ev) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      const m = msg as {
        method?: string;
        params?: {
          type?: string;
          channel?: string;
          data?: { price?: number; index_name?: string };
        };
      };

      // Heartbeat: Deribit sends notification with type === 'test_request' that
      // requires a `public/test` reply, OR plain 'heartbeat' that needs no reply.
      if (m.method === 'heartbeat') {
        if (m.params?.type === 'test_request') {
          ws?.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: nextRpcId++,
              method: 'public/test',
              params: {},
            })
          );
        }
        return;
      }

      if (m.method !== 'subscription') return;
      const data = m.params?.data;
      if (!data || typeof data.price !== 'number') return;
      const idx = data.index_name;
      if (idx === 'btc_usd') onPrice('BTC', data.price);
      else if (idx === 'eth_usd') onPrice('ETH', data.price);
    });

    ws.addEventListener('close', () => {
      ws = null;
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // close handler will fire next; just let it
      try {
        ws?.close();
      } catch {}
    });
  }

  function scheduleReconnect() {
    if (stopped) return;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) return;
    const backoff = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** attempt
    );
    const jitter = Math.random() * 250;
    attempt += 1;
    reconnectTimer = setTimeout(connect, backoff + jitter);
  }

  connect();

  return {
    close() {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        ws?.close();
      } catch {}
      ws = null;
    },
  };
}
