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
            <h1 className="text-xl font-bold text-text">Live Activity</h1>
            <p className="mt-1 text-sm text-text-muted">
              Bets you place will stream here in real time.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-line bg-bg-elev p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'press-scale rounded-sm px-3 py-1.5 text-sm font-medium transition-all duration-180',
                  filter === f.id
                    ? 'bg-text text-bg-elev'
                    : 'text-text-muted hover:text-text'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-line bg-bg-elev">
          {rows.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-md font-medium text-text">Quiet on the wire</p>
              <p className="max-w-sm text-sm text-text-muted">
                Place a bet on the Markets page to see the feed light up. The
                activity feed currently shows fills you initiate from this
                browser session.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
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
      : 'bg-text-dim';
  const tag =
    item.kind === 'filled'
      ? { label: 'FILLED', cls: 'bg-pump-light dark:bg-pump/15 text-pump dark:text-pump-dark' }
      : item.kind === 'cancelled'
      ? { label: 'CANCELLED', cls: 'bg-dump-light dark:bg-dump/15 text-dump dark:text-dump-dark' }
      : { label: 'NEW', cls: 'bg-brand-light dark:bg-brand/15 text-brand' };

  return (
    <li className="grid animate-fade-in grid-cols-[16px_1fr_120px_80px] items-center gap-3 px-4 py-3 transition-colors duration-180 hover:bg-surface-hover">
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      <span className="truncate text-sm text-text">{item.question ?? item.kind}</span>
      <span
        className={cn(
          'justify-self-end rounded-md px-2 py-0.5 text-xs font-bold uppercase',
          tag.cls
        )}
      >
        {tag.label}
      </span>
      <span className="num justify-self-end text-xs text-text-dim">{ago(item.ts)}</span>
    </li>
  );
}

function ago(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
