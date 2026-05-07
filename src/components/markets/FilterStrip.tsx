'use client';

import { useAppStore, type FilterTab, type SortKey } from '@/store/app';
import { cn } from '@/lib/utils';

const tabs: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pump', label: 'PUMP' },
  { id: 'dump', label: 'DUMP' },
  { id: 'range', label: 'RANGE' },
  { id: 'soon', label: 'Ending Soon' },
];

const sorts: { id: SortKey; label: string }[] = [
  { id: 'volume', label: 'Most Volume' },
  { id: 'newest', label: 'Newest' },
  { id: 'soon', label: 'Ending Soon' },
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
  const { filter, sort, setFilter, setSort } = useAppStore();
  return (
    <div className="border-b border-line bg-bg-elev/60 backdrop-blur">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-6 py-3">
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
