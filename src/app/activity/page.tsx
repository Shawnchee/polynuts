'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { useAppStore, type ActivityItem } from '@/store/app';
import { cn } from '@/lib/utils';

type ActivityFilter = 'all' | 'PUMP' | 'DUMP' | 'RANGE' | 'wins';

const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PUMP', label: 'PUMP' },
  { id: 'DUMP', label: 'DUMP' },
  { id: 'RANGE', label: 'RANGE' },
  { id: 'wins', label: 'Wins' },
];

export default function ActivityPage() {
  const activity = useAppStore((s) => s.activity);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const rows = useMemo(() => {
    if (filter === 'all') return activity;
    if (filter === 'wins') return activity.filter((a) => a.kind === 'filled');
    return activity.filter((a) => a.direction === filter);
  }, [activity, filter]);

  return (
    <PageShell active="/activity">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink-900">Live Activity</h1>
            <p className="mt-1 text-sm text-ink-600">
              Every order, fill, and cancel hitting the OptionBook in real time.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  filter === f.id
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
          {rows.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-md font-medium text-ink-900">Quiet on the wire</p>
              <p className="max-w-sm text-sm text-ink-600">
                Once orders fill on the OptionBook, you&apos;ll see them stream in
                here live. No reload needed.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-200">
              {rows.map((row) => (
                <Row key={row.id} item={row} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Row({ item }: { item: ActivityItem }) {
  const dot =
    item.direction === 'PUMP'
      ? 'bg-pump'
      : item.direction === 'DUMP'
      ? 'bg-dump'
      : item.direction === 'RANGE'
      ? 'bg-range'
      : 'bg-ink-400';
  const tag =
    item.kind === 'filled'
      ? { label: 'FILLED', cls: 'bg-pump-light text-pump' }
      : item.kind === 'cancelled'
      ? { label: 'CANCELLED', cls: 'bg-dump-light text-dump' }
      : { label: 'NEW', cls: 'bg-brand-light text-brand' };

  return (
    <li className="grid animate-fade-in grid-cols-[16px_1fr_120px_80px] items-center gap-3 px-4 py-3">
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      <span className="truncate text-sm text-ink-900">
        {item.question ?? item.kind}
      </span>
      <span
        className={cn(
          'justify-self-end rounded-sm px-2 py-0.5 text-xs font-bold uppercase',
          tag.cls
        )}
      >
        {tag.label}
      </span>
      <span className="num justify-self-end text-xs text-ink-400">{ago(item.ts)}</span>
    </li>
  );
}

function ago(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
