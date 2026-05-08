'use client';

import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const SYMBOL_MAP: Record<string, string> = {
  ETH: 'COINBASE:ETHUSD',
  BTC: 'COINBASE:BTCUSD',
  SOL: 'COINBASE:SOLUSD',
  DOGE: 'BINANCE:DOGEUSDT',
  XRP: 'COINBASE:XRPUSD',
  BNB: 'BINANCE:BNBUSDT',
  AVAX: 'COINBASE:AVAXUSD',
};

function tvSymbol(asset: string): string | null {
  const upper = asset.toUpperCase();
  if (upper in SYMBOL_MAP) return SYMBOL_MAP[upper];
  if (/^[A-Z]{2,6}$/.test(upper)) return `COINBASE:${upper}USD`;
  return null;
}

/**
 * TradingView spot chart for the underlying asset.
 *
 * Uses the public widgetembed iframe URL — far simpler than the script
 * embed (which requires a precise DOM scaffold and silently fails to
 * render when the structure is off). The iframe is keyed on
 * (symbol, theme) so a dark↔light toggle replaces it cleanly.
 */
export function TradingViewChart({
  asset,
  height = 240,
}: {
  asset: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const symbol = tvSymbol(asset);

  if (!symbol) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-line bg-bg-elev text-sm text-text-dim"
        style={{ height }}
      >
        Chart unavailable for {asset}
      </div>
    );
  }

  // Build the public widget URL — these params are documented at
  // https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
  const params = new URLSearchParams({
    symbol,
    interval: '15',
    theme: theme === 'dark' ? 'dark' : 'light',
    style: '1', // candles
    locale: 'en',
    timezone: 'Etc/UTC',
    hideideas: '1',
    hidetoptoolbar: '1',
    hidesidetoolbar: '1',
    save_image: '0',
    studies: '[]',
  });
  const src = `https://s.tradingview.com/widgetembed/?${params.toString()}`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-line bg-bg-elev'
      )}
      style={{ height }}
    >
      <iframe
        // key forces React to fully unmount/remount the iframe on
        // symbol/theme change — avoids stale cached chart state.
        key={`${symbol}-${theme}`}
        src={src}
        title={`${asset} chart`}
        allow="fullscreen"
        loading="lazy"
        className="h-full w-full border-0"
      />
    </div>
  );
}
