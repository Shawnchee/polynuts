'use client';

import {
  useAppStore,
  type FilterTab,
  type SortKey,
  type TimeframeKey,
} from '@/store/app';
import { cn } from '@/lib/utils';

const tabs: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pump', label: 'PUMP' },
  { id: 'dump', label: 'DUMP' },
  { id: 'range', label: 'RANGE' },
];

const timeframes: { id: TimeframeKey; label: string }[] = [
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1h' },
  { id: '24h', label: '24h' },
  { id: '3d', label: '3d' },
  { id: '7d', label: '7d' },
  { id: 'all', label: 'All' },
];

const sorts: { id: SortKey; label: string }[] = [
  { id: 'soon', label: 'Ending Soon' },
  { id: 'volume', label: 'Most Volume' },
  { id: 'newest', label: 'Newest' },
  { id: 'payout', label: 'Highest Payout' },
];

const tabAccent: Record<FilterTab, string> = {
  all: 'bg-surface text-text',
  pump: 'bg-pump/15 text-pump dark:text-pump-dark border border-pump/30',
  dump: 'bg-dump/15 text-dump dark:text-dump-dark border border-dump/30',
  range: 'bg-range/15 text-range dark:text-range-dark border border-range/30',
  soon: 'bg-gold/15 text-gold border border-gold/30',
};

export function FilterStrip({ count }: { count: number }) {
  const { filter, sort, timeframe, setFilter, setSort, setTimeframe } =
    useAppStore();
  return (
    <div className="border-b border-line bg-bg-elev/60 backdrop-blur">
      <div className="mx-auto flex max-w-page flex-col gap-2 px-6 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        {/* Direction tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                'press-scale rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-180',
                filter === t.id
                  ? tabAccent[t.id]
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Timeframe chips — Polymarket-style short windows */}
        <div className="flex items-center gap-2">
          <span className="label text-text-dim hidden sm:inline">Expires in</span>
          <div className="flex items-center gap-1 rounded-md border border-line bg-surface p-1">
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={cn(
                  'press-scale rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors duration-120',
                  timeframe === tf.id
                    ? 'bg-text text-bg-elev'
                    : 'text-text-muted hover:text-text'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count + sort */}
        <div className="flex items-center gap-3">
          <span className="num text-sm text-text-muted">
            <span className="num font-semibold text-text">{count}</span> markets
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-text hover:bg-surface-hover focus:outline-none transition-colors duration-120"
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
