'use client';

import { useAppStore } from '@/store/app';
import { useMarketData } from '@/lib/sdk/useOrders';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const activity = useAppStore((s) => s.activity);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[280px]">
      <PriceTickers />
      <Panel title="Live Activity" subtitle="On-chain fills">
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {activity.length === 0 ? (
            <Empty
              title="No activity yet"
              msg="Live fills appear here as bets settle on-chain."
            />
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

function Empty({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
      <p className="text-sm font-medium text-text-muted">{title}</p>
      <p className="text-xs text-text-dim">{msg}</p>
    </div>
  );
}

function PriceTickers() {
  // Isolate price-tick re-renders to this subtree — the activity list above
  // no longer flashes on every Deribit tick.
  return (
    <div className="grid grid-cols-2 gap-2">
      <PriceTicker symbol="ETH" />
      <PriceTicker symbol="BTC" />
    </div>
  );
}

function PriceTicker({ symbol }: { symbol: 'ETH' | 'BTC' }) {
  const livePrice = useAppStore((s) => s.prices[symbol]);
  const { data: indexerPrices } = useMarketData();
  const price = livePrice ?? indexerPrices?.prices?.[symbol];
  return (
    <div className="rounded-xl border border-line bg-bg-elev px-3 py-2.5 transition-colors duration-180 hover:bg-surface-hover">
      <div className="label text-text-dim">{symbol}</div>
      <div className="num mt-0.5 text-md font-bold tabular-nums text-text">
        {typeof price === 'number' && Number.isFinite(price)
          ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          : (
            <span
              aria-label={`${symbol} price loading`}
              className="inline-block h-5 w-14 animate-pulse rounded bg-surface-hover align-middle"
            />
          )}
      </div>
    </div>
  );
}

function agoLabel(ts: number): string {
  if (!Number.isFinite(ts)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
