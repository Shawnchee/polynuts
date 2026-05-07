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

export function FilterStrip({ count }: { count: number }) {
  const { filter, sort, setFilter, setSort } = useAppStore();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-white px-6 py-3">
      <div className="flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === t.id
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="num text-sm text-ink-600">
          <span className="num font-semibold text-ink-900">{count}</span> markets
        </span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 hover:border-ink-400 focus:outline-none"
        >
          {sorts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
