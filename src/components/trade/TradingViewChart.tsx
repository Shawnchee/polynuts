'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const TV_SCRIPT = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

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
  // Best-effort fallback — most majors trade on Coinbase under TICKERUSD
  if (/^[A-Z]{2,6}$/.test(upper)) return `COINBASE:${upper}USD`;
  return null;
}

export function TradingViewChart({
  asset,
  height = 240,
}: {
  asset: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const symbol = tvSymbol(asset);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const containerId = `tv-chart-${reactId.replace(/:/g, '-')}-${asset}-${theme}`;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;
    setLoaded(false);
    const host = containerRef.current;
    // Wipe any previous widget iframe before injecting the new one
    host.innerHTML = '';
    const inner = document.createElement('div');
    inner.id = containerId;
    inner.style.height = '100%';
    inner.style.width = '100%';
    host.appendChild(inner);

    const script = document.createElement('script');
    script.src = TV_SCRIPT;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: theme === 'dark' ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      toolbar_bg: theme === 'dark' ? '#0a0c12' : '#ffffff',
      enable_publishing: false,
      hide_top_toolbar: true,
      hide_legend: true,
      save_image: false,
      container_id: containerId,
    });
    script.onload = () => setLoaded(true);
    host.appendChild(script);

    return () => {
      // Detach the widget cleanly on asset/theme change so we don't stack iframes.
      host.innerHTML = '';
    };
  }, [symbol, theme, containerId]);

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

  return (
    <div
      className="relative overflow-hidden rounded-md border border-line bg-bg-elev"
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!loaded && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent'
          )}
        />
      )}
    </div>
  );
}
