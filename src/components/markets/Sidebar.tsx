'use client';

import { useAppStore } from '@/store/app';
import { useMarketData } from '@/lib/sdk/useOrders';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const activity = useAppStore((s) => s.activity);
  const livePrices = useAppStore((s) => s.prices);
  // Fall back to the Thetanuts indexer's market-data feed when Deribit's
  // WS is silent (e.g. tab just opened or socket reconnecting). MCP-verified
  // to return live ETH/BTC/SOL/XRP/BNB/AVAX/DOGE prices on Base.
  const { data: indexerPrices } = useMarketData();
  const eth = livePrices.ETH ?? indexerPrices?.prices?.ETH;
  const btc = livePrices.BTC ?? indexerPrices?.prices?.BTC;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[280px]">
      <PriceTickers eth={eth} btc={btc} />
      <Panel title="Live Activity" subtitle="On-chain fills">
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {activity.length === 0 ? (
            <Empty msg="Place a bet to start the feed." />
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex animate-fade-in items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        item.direction === 'PUMP' && 'bg-pump',
                        item.direction === 'DUMP' && 'bg-dump',
                        item.direction === 'RANGE' && 'bg-range',
                        !item.direction && 'bg-text-dim'
                      )}
                    />
                    <span className="truncate text-text">
                      {item.question ?? 'Order update'}
                    </span>
                  </div>
                  <span className="num shrink-0 text-xs text-text-dim">
                    {agoLabel(item.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </aside>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-elev">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="label text-text-muted">{title}</span>
        {subtitle && <span className="text-xs text-text-dim">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="px-3 py-8 text-center text-sm text-text-dim">{msg}</p>;
}

function PriceTickers({ eth, btc }: { eth?: number; btc?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <PriceTicker symbol="ETH" price={eth} />
      <PriceTicker symbol="BTC" price={btc} />
    </div>
  );
}

function PriceTicker({ symbol, price }: { symbol: string; price?: number }) {
  return (
    <div className="rounded-xl border border-line bg-bg-elev px-3 py-2.5 transition-colors duration-180 hover:bg-surface-hover">
      <div className="label text-text-dim">{symbol}</div>
      <div className="num mt-0.5 text-md font-bold tabular-nums text-text">
        {price !== undefined
          ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          : '—'}
      </div>
    </div>
  );
}

function agoLabel(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
