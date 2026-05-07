'use client';

import { useAppStore } from '@/store/app';
import { useMarketData } from '@/lib/sdk/useOrders';
import { DirectionTag } from '@/components/ui/DirectionTag';

export function Sidebar() {
  const activity = useAppStore((s) => s.activity);
  const livePrices = useAppStore((s) => s.prices);
  const { data: marketData } = useMarketData();

  const eth = livePrices.ETH ?? marketData?.prices?.ETH;
  const btc = livePrices.BTC ?? marketData?.prices?.BTC;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4">
      <PriceTickers eth={eth} btc={btc} />
      <Panel title="Live Activity">
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {activity.length === 0 ? (
            <Empty msg="No activity yet — place a bet to start the feed." />
          ) : (
            <ul className="divide-y divide-ink-200">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm animate-fade-in"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          item.direction === 'PUMP'
                            ? '#16A34A'
                            : item.direction === 'DUMP'
                            ? '#DC2626'
                            : '#7C3AED',
                      }}
                    />
                    <span className="truncate text-ink-900">{item.question ?? 'New market'}</span>
                  </div>
                  <span className="num shrink-0 text-xs text-ink-400">
                    {agoLabel(item.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title="Top Traders · This Week">
        <Empty msg="Leaderboard will populate as fills land." />
      </Panel>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
        <span className="label text-ink-600">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="px-3 py-6 text-center text-sm text-ink-400">{msg}</p>;
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
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2">
      <div className="label text-ink-400">{symbol}</div>
      <div className="num mt-0.5 text-md font-bold tabular-nums text-ink-900">
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
