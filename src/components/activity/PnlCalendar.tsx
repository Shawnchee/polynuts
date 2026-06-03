'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const WEEKS = 13;
const DAYS = WEEKS * 7;
const DAY_MS = 86_400_000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Pre-resolved settled trade for heatmap aggregation. */
export interface PnlEntry {
  /** Milliseconds since epoch — the trade's settlement (or trade) time. */
  ts: number;
  /** Net realized PnL in USD. */
  pnl: number;
}

interface PnlCalendarProps {
  entries: PnlEntry[];
}

interface DayCell {
  date: Date;
  key: string;
  pnl: number;
  count: number;
}

export function PnlCalendar({ entries }: PnlCalendarProps) {
  const days = useMemo(() => buildDays(entries), [entries]);
  const maxPos = useMemo(
    () => days.reduce((m, d) => (d.pnl > m ? d.pnl : m), 0),
    [days],
  );
  const maxNeg = useMemo(
    () => days.reduce((m, d) => (d.pnl < m ? d.pnl : m), 0),
    [days],
  );
  const totalPnl = useMemo(
    () => days.reduce((s, d) => s + d.pnl, 0),
    [days],
  );
  const activeDays = useMemo(() => days.filter((d) => d.count > 0).length, [days]);
  const hasData = activeDays > 0;

  const weeks = useMemo(() => {
    const w: DayCell[][] = [];
    for (let i = 0; i < WEEKS; i++) {
      w.push(days.slice(i * 7, i * 7 + 7));
    }
    return w;
  }, [days]);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-bg-elev p-4 animate-fade-in">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-md font-semibold text-text">Realized PnL — last 13 weeks</h2>
          <p className="mt-0.5 text-xs text-text-dim">
            {hasData
              ? `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} · net ${fmtSigned(totalPnl)}`
              : 'No settled trades in the last 13 weeks'}
          </p>
        </div>
        <Legend hasData={hasData} />
      </header>

      <div className="scrollbar-thin overflow-x-auto">
        <div className="flex gap-1.5">
          <div className="flex shrink-0 flex-col justify-between pr-1 text-[9px] text-text-dim">
            {DAY_LABELS.map((d, i) => (
              <span
                key={d}
                className={cn('h-3 sm:h-3.5 leading-3', i % 2 === 1 ? 'opacity-100' : 'opacity-0')}
                aria-hidden="true"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell) => (
                  <Cell key={cell.key} cell={cell} maxPos={maxPos} maxNeg={maxNeg} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Cell({
  cell,
  maxPos,
  maxNeg,
}: {
  cell: DayCell;
  maxPos: number;
  maxNeg: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const future = cell.date.getTime() > Date.now();
  const bucket = cell.count === 0 ? 0 : bucketOf(cell.pnl, maxPos, maxNeg);
  const cls = cellClass(cell.pnl, bucket, future);
  const label = future
    ? formatDate(cell.date)
    : cell.count === 0
    ? `${formatDate(cell.date)}: no trades`
    : `${formatDate(cell.date)}: ${fmtSigned(cell.pnl)}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-[3px] border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          cls,
        )}
      />
      {open && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-bg-elev px-2 py-1 text-xs shadow-lg"
        >
          <div className="num font-medium text-text">{formatDate(cell.date)}</div>
          {!future && (
            <div
              className={cn(
                'num tabular-nums',
                cell.count === 0
                  ? 'text-text-dim'
                  : cell.pnl > 0
                  ? 'text-pump dark:text-pump-dark'
                  : cell.pnl < 0
                  ? 'text-dump dark:text-dump-dark'
                  : 'text-text-muted',
              )}
            >
              {cell.count === 0 ? '—' : fmtSigned(cell.pnl)}
              {cell.count > 1 && (
                <span className="ml-1 text-text-dim">· {cell.count} trades</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ hasData }: { hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
        <span>—</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
      <span>Less</span>
      <span className="h-3 w-3 rounded-[3px] border border-line bg-bg-subtle" />
      <span className="h-3 w-3 rounded-[3px] border border-pump/30 bg-pump/20 dark:border-pump-dark/30 dark:bg-pump-dark/20" />
      <span className="h-3 w-3 rounded-[3px] border border-pump/40 bg-pump/40 dark:border-pump-dark/40 dark:bg-pump-dark/40" />
      <span className="h-3 w-3 rounded-[3px] border border-pump/60 bg-pump/60 dark:border-pump-dark/60 dark:bg-pump-dark/60" />
      <span className="h-3 w-3 rounded-[3px] border border-pump bg-pump/80 dark:border-pump-dark dark:bg-pump-dark/80" />
      <span>More</span>
    </div>
  );
}

function buildDays(entries: PnlEntry[]): DayCell[] {
  const today = startOfDay(new Date());
  const start = new Date(today.getTime() - (DAYS - 1) * DAY_MS);
  const map = new Map<string, { pnl: number; count: number }>();
  for (const e of entries) {
    if (!Number.isFinite(e.pnl)) continue;
    const d = startOfDay(new Date(e.ts));
    if (d.getTime() < start.getTime() || d.getTime() > today.getTime()) continue;
    const k = isoKey(d);
    const cur = map.get(k) ?? { pnl: 0, count: 0 };
    cur.pnl += e.pnl;
    cur.count += 1;
    map.set(k, cur);
  }
  // Align the grid so today sits in the last (rightmost) column.
  const todayWeekday = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  const gridEnd = new Date(today.getTime() + (6 - todayWeekday) * DAY_MS);
  const gridStart = new Date(gridEnd.getTime() - (DAYS - 1) * DAY_MS);
  const out: DayCell[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(gridStart.getTime() + (w * 7 + r) * DAY_MS);
      const k = isoKey(d);
      const v = map.get(k);
      out.push({ date: d, key: k, pnl: v?.pnl ?? 0, count: v?.count ?? 0 });
    }
  }
  return out;
}

function bucketOf(pnl: number, maxPos: number, maxNeg: number): 1 | 2 | 3 | 4 {
  if (pnl > 0) {
    const ratio = maxPos > 0 ? pnl / maxPos : 0;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  }
  const ratio = maxNeg < 0 ? pnl / maxNeg : 0;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function cellClass(pnl: number, bucket: number, future: boolean): string {
  if (future) return 'border-transparent bg-transparent';
  if (bucket === 0) return 'border-line/60 bg-bg-subtle';
  if (pnl > 0) {
    switch (bucket) {
      case 1:
        return 'border-pump/30 bg-pump/20 dark:border-pump-dark/30 dark:bg-pump-dark/20';
      case 2:
        return 'border-pump/40 bg-pump/40 dark:border-pump-dark/40 dark:bg-pump-dark/40';
      case 3:
        return 'border-pump/60 bg-pump/60 dark:border-pump-dark/60 dark:bg-pump-dark/60';
      default:
        return 'border-pump bg-pump/80 dark:border-pump-dark dark:bg-pump-dark/80';
    }
  }
  if (pnl < 0) {
    switch (bucket) {
      case 1:
        return 'border-dump/30 bg-dump/20 dark:border-dump-dark/30 dark:bg-dump-dark/20';
      case 2:
        return 'border-dump/40 bg-dump/40 dark:border-dump-dark/40 dark:bg-dump-dark/40';
      case 3:
        return 'border-dump/60 bg-dump/60 dark:border-dump-dark/60 dark:bg-dump-dark/60';
      default:
        return 'border-dump bg-dump/80 dark:border-dump-dark dark:bg-dump-dark/80';
    }
  }
  return 'border-line/60 bg-bg-subtle';
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSigned(amount: number): string {
  const abs = Math.abs(amount);
  const digits = abs === 0 ? 2 : abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${sign}${Math.abs(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
