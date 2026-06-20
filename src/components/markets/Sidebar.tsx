'use client';

import { useAppStore } from '@/store/app';
import { useMarketData } from '@/lib/sdk/useOrders';
import {
  useRecentTradesDb,
  type RecentTradeDbRow,
} from '@/lib/sdk/useRecentTradesDb';
import type { Direction } from '@/lib/sdk/markets';
import { cn, fmtTimeAgo, fmtUsd } from '@/lib/utils';

export function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[280px]">
      <PriceTickers />
      <LiveActivity />
    </aside>
  );
}

// Real bets placed on Polynuts, newest first — pulled from our own `trades`
// table (useRecentTradesDb) rather than the in-memory on-chain log poller,
// which sat empty on free-tier RPC and left this panel reading "No activity
// yet" even when people were trading.
function LiveActivity() {
  const { data, isLoading, error } = useRecentTradesDb(12);
  const trades = data ?? [];
  const live = trades.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-elev">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {live && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pump opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                live ? 'bg-pump' : 'bg-text-dim'
              )}
            />
          </span>
          <span className="label text-text-muted">Live Activity</span>
        </div>
        <span className="text-xs text-text-dim">Latest bets</span>
      </div>

      <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </ul>
        ) : error || trades.length === 0 ? (
          <Empty
            title="No bets yet"
            msg="Fills land here the moment players place bets on Polynuts."
          />
        ) : (
          <ul className="divide-y divide-line">
            {trades.map((t) => (
              <ActivityRow key={`${t.tx_hash}-${t.option_id}`} trade={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function asDirection(side: string | null): Direction | null {
  const s = (side ?? '').toUpperCase();
  return s === 'PUMP' || s === 'DUMP' || s === 'RANGE' ? (s as Direction) : null;
}

function ActivityRow({ trade }: { trade: RecentTradeDbRow }) {
  const dir = asDirection(trade.side);
  return (
    <li className="flex animate-fade-in items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-hover">
      <span className={cn('h-8 w-1 shrink-0 rounded-full', accentCls(dir))} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight text-text">
          {trade.market_label ?? 'Option'}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-dim">
          {dir && (
            <span className={cn('font-bold uppercase tracking-wide', dirTextCls(dir))}>
              {dir}
            </span>
          )}
          {dir && <span className="text-line">·</span>}
          <span className="num">{fmtTimeAgo(trade.created_at)}</span>
        </div>
      </div>
      <span className="num shrink-0 text-sm font-semibold tabular-nums text-text">
        {fmtUsd(Number(trade.notional_usdc))}
      </span>
    </li>
  );
}

function accentCls(dir: Direction | null): string {
  if (dir === 'PUMP') return 'bg-pump';
  if (dir === 'DUMP') return 'bg-dump';
  if (dir === 'RANGE') return 'bg-range';
  return 'bg-text-dim';
}

function dirTextCls(dir: Direction): string {
  if (dir === 'PUMP') return 'text-pump dark:text-pump-dark';
  if (dir === 'DUMP') return 'text-dump dark:text-dump-dark';
  return 'text-range dark:text-range-dark';
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="h-8 w-1 shrink-0 rounded-full bg-line" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-32 animate-pulse rounded bg-line" />
        <div className="h-2.5 w-20 animate-pulse rounded bg-line" />
      </div>
      <div className="h-3 w-10 animate-pulse rounded bg-line" />
    </li>
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
          ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
