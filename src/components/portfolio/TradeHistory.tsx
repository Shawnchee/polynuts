'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import { usePositions } from '@/lib/sdk/usePortfolio';
import { usePositionMarks, type PositionMark } from '@/lib/sdk/usePositionMark';
import { getReadClient } from '@/lib/sdk/clients';
import { txUrl } from '@/lib/sdk/explorer';
import { PnlPill } from '@/components/portfolio/PnlPill';
import { TableSkeleton } from '@/components/portfolio/TableSkeleton';
import { PnlCalendar } from '@/components/activity/PnlCalendar';
import { dbBacked, useTradeHistoryDb } from '@/lib/sdk/useTradeHistoryDb';
import {
  mergeRowsDb,
  summaryFromDbRows,
  calendarEntriesFromDbRows,
  type MergedRow,
} from '@/lib/sdk/tradeHistoryView';
import type { ActivitySummary } from '@/lib/sdk/positionLogic';
import { cn, fmtUsd } from '@/lib/utils';

type ActivityFilter = 'all' | 'PUMP' | 'DUMP' | 'RANGE' | 'wins';

const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PUMP', label: 'PUMP' },
  { id: 'DUMP', label: 'DUMP' },
  { id: 'RANGE', label: 'RANGE' },
  { id: 'wins', label: 'Wins' },
];

// The "History" section of /portfolio: settled outcomes, lifetime PnL, win
// rate, and the PnL calendar. Trade history is read EXCLUSIVELY from our own
// Supabase DB (Polynuts trades only — consistent with the leaderboard); the
// indexer is the sync source that populates that DB, never a parallel read
// path. Live open positions still come from the indexer (the DB doesn't track
// their streaming mark) and borrow their real cost basis from the matching DB
// fill. The portfolio page composes this below the open-positions table.
export function TradeHistory() {
  const { isConnected } = useAccount();
  const useDb = dbBacked();

  const {
    data: positions = [],
    isLoading: posLoading,
    isFetching: posFetching,
    refetch: refetchPositions,
  } = usePositions();
  const {
    data: dbRows = [],
    isLoading: dbLoading,
    isFetching: dbFetching,
    isError: dbError,
    refetch: refetchDb,
  } = useTradeHistoryDb();
  const markOf = usePositionMarks();

  const [filter, setFilter] = useState<ActivityFilter>('all');

  // Positions + history auto-refetch on an interval, but a fresh fill or
  // settlement can land between ticks — this pulls the latest on demand. Spin /
  // disable while any active query is in flight to avoid hammering the API.
  const refreshing = posFetching || dbFetching;
  const handleRefresh = useCallback(() => {
    void refetchPositions();
    void refetchDb();
  }, [refetchPositions, refetchDb]);

  const summary = useMemo<ActivitySummary>(() => summaryFromDbRows(dbRows), [dbRows]);

  const merged = useMemo(
    () => mergeRowsDb(positions, dbRows, getReadClient().utils),
    [positions, dbRows],
  );

  const calendarEntries = useMemo(() => calendarEntriesFromDbRows(dbRows), [dbRows]);

  const rows = useMemo(() => {
    if (filter === 'all') return merged;
    if (filter === 'wins') {
      return merged.filter((r) => {
        if (r.realizedPnl != null) return r.realizedPnl > 0;
        if (r.position) {
          const v = markOf(r.position).unrealizedUsd;
          return Number.isFinite(v) && v > 0;
        }
        return false;
      });
    }
    return merged.filter((r) => r.direction === filter);
  }, [merged, filter, markOf]);

  const loading = isConnected && (posLoading || dbLoading);
  const openCount = merged.filter((r) => r.status.toUpperCase() === 'OPEN').length;

  // History is DB-sourced; without Supabase configured/reachable it can't
  // render. Show a clear degraded notice rather than a silent empty table or a
  // divergent indexer fallback. Live positions (page section above) are
  // indexer-backed and unaffected.
  if (!useDb) {
    return <HistoryUnavailable />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-md font-semibold text-text">History</h2>
        <p className="text-sm text-text-muted">
          {openCount > 0
            ? `${openCount} live ${openCount === 1 ? 'position' : 'positions'} • all settled outcomes below`
            : 'Your settled outcomes, cancelled offers, and any live positions.'}
        </p>
      </header>

      {/* History is DB-only now (no indexer fallback). Surface a fetch failure
          explicitly so a transient Supabase/API blip reads as "couldn't load"
          with a retry — not a silent "No trades yet / $0" that looks like the
          user's settled PnL vanished. */}
      {dbError && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dump/40 bg-dump/5 px-3 py-2 text-xs text-dump dark:text-dump-dark">
          <span>Couldn&apos;t load your settled history — figures below may be incomplete.</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="press-scale shrink-0 rounded-md border border-dump/40 px-2 py-0.5 font-medium transition-colors hover:bg-dump/10 disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      )}

      <SummaryStrip
        summary={summary}
        loading={loading && summary.settledCount === 0}
        connected={isConnected}
      />

      <PnlCalendar entries={calendarEntries} />

      <div className="flex items-center justify-between gap-3">
        <RefreshButton busy={refreshing} onClick={handleRefresh} />
        <div
          className="flex items-center gap-1 rounded-md border border-line bg-bg-elev p-1"
          role="tablist"
          aria-label="Filter activity"
        >
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'press-scale inline-flex min-h-[40px] items-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all duration-180 sm:min-h-0',
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
        {loading ? (
          <TableSkeleton cols={7} rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState connected={isConnected} />
        ) : (
          <ActivityTable rows={rows} markOf={markOf} />
        )}
      </section>
    </div>
  );
}

function HistoryUnavailable() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-md font-semibold text-text">History</h2>
        <p className="text-sm text-text-muted">Settled outcomes and lifetime P&amp;L.</p>
      </header>
      <div className="flex h-[30vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-bg-elev px-4 text-center">
        <p className="text-md font-medium text-text">History is warming up</p>
        <p className="max-w-sm text-sm text-text-muted">
          Your settled-trade history and P&amp;L are served from the Polynuts
          database, which isn&apos;t reachable right now. Your live positions
          above are unaffected — check back in a moment.
        </p>
      </div>
    </div>
  );
}

function SummaryStrip({
  summary,
  loading,
  connected,
}: {
  summary: ActivitySummary;
  loading: boolean;
  connected: boolean;
}) {
  if (loading) return <SummarySkeleton />;
  const hasData = summary.settledCount > 0;
  const tiles: {
    label: string;
    value: React.ReactNode;
    sub?: string;
  }[] = [
    {
      label: 'Lifetime PnL',
      value: hasData ? (
        <PnlPill amount={summary.lifetimePnl} />
      ) : (
        <span className="text-text-dim">—</span>
      ),
      sub: hasData ? `${summary.settledCount} settled` : connected ? 'no settles yet' : 'connect wallet',
    },
    {
      label: 'Win rate',
      value: hasData ? (
        <span className="num font-bold tabular-nums text-text">
          {Math.round(summary.winRate * 100)}%
        </span>
      ) : (
        <span className="text-text-dim">—</span>
      ),
      sub: hasData ? `${summary.wins} of ${summary.settledCount}` : undefined,
    },
    {
      label: 'Best trade',
      value: hasData && summary.bestTrade > 0 ? (
        <PnlPill amount={summary.bestTrade} />
      ) : (
        <span className="text-text-dim">—</span>
      ),
      sub: summary.bestTradeLabel,
    },
    {
      label: 'Current streak',
      value: hasData ? (
        <span
          className={cn(
            'num font-bold tabular-nums',
            summary.streak > 0 ? 'text-pump dark:text-pump-dark' : 'text-text',
          )}
        >
          {summary.streak > 0 ? `🔥 ${summary.streak}` : '0'}
        </span>
      ) : (
        <span className="text-text-dim">—</span>
      ),
      sub: summary.streak > 0 ? `consecutive ${summary.streak === 1 ? 'win' : 'wins'}` : 'no streak',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className="card-lift rounded-xl border border-line bg-bg-elev px-4 py-3 animate-fade-in"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="label text-text-dim">{t.label}</div>
          <div className="mt-1 text-lg leading-tight">{t.value}</div>
          {t.sub && (
            <div className="mt-1 truncate text-xs text-text-dim" title={t.sub}>
              {t.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-bg-elev px-4 py-3 animate-pulse"
        >
          <div className="h-3 w-20 rounded bg-bg-subtle" />
          <div className="mt-2 h-6 w-28 rounded bg-bg-subtle" />
          <div className="mt-2 h-3 w-16 rounded bg-bg-subtle" />
        </div>
      ))}
    </div>
  );
}

/**
 * Manual refresh for the History section. Matches the open-positions table's
 * RefreshButton (portfolio/page.tsx): spins + disables while a fetch is in
 * flight to avoid hammering the indexer / DB API.
 */
function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      title="Refresh history"
      className="press-scale inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw aria-hidden className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}

function EmptyState({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-md font-medium text-text">Connect wallet to see your activity</p>
        <p className="max-w-sm text-sm text-text-muted">
          Your on-chain bets and settled outcomes show up here once your wallet is connected.
        </p>
        <ConnectButton />
      </div>
    );
  }
  return (
    <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-md font-medium text-text">No trades yet</p>
      <p className="max-w-sm text-sm text-text-muted">
        Place a bet and your fills, settlements, and P&amp;L will light up here.
      </p>
      <Link
        href="/"
        className="press-scale rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        Browse markets
      </Link>
    </div>
  );
}

function ActivityTable({
  rows,
  markOf,
}: {
  rows: MergedRow[];
  markOf: (p: Position) => PositionMark;
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-bg-subtle text-left">
          <tr className="label text-text-muted">
            <Th>Time</Th>
            <Th>Market</Th>
            <Th>Side</Th>
            <Th align="right">Contracts</Th>
            <Th align="right">Cost</Th>
            <Th align="right">PnL</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key} className="transition-colors hover:bg-surface-hover">
              <Td>
                {txUrl(r.txHash) ? (
                  <a
                    href={txUrl(r.txHash)!}
                    target="_blank"
                    rel="noreferrer"
                    title="View transaction on Basescan"
                    className="num inline-flex items-center gap-1 text-text-muted transition-colors hover:text-text"
                  >
                    {ago(r.ts)}
                    <ExternalLink aria-hidden className="h-3 w-3 opacity-70" />
                  </a>
                ) : (
                  <span className="num text-text-muted">{ago(r.ts)}</span>
                )}
              </Td>
              <Td>
                <span className="font-medium text-text">{r.label}</span>
                {r.settlePrice != null && Number.isFinite(r.settlePrice) && (
                  <span className="ml-2 text-xs text-text-dim">
                    settled @ {fmtPriceCompact(r.settlePrice)}
                  </span>
                )}
              </Td>
              <Td>
                {r.side ? (
                  <span
                    className={cn(
                      'font-semibold uppercase',
                      r.side === 'buyer'
                        ? 'text-pump dark:text-pump-dark'
                        : 'text-dump dark:text-dump-dark'
                    )}
                  >
                    {r.side === 'buyer' ? 'YES' : 'NO'}
                  </span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </Td>
              <Td align="right" mono>
                {r.contracts != null && Number.isFinite(r.contracts)
                  ? r.contracts.toLocaleString('en-US', { maximumFractionDigits: 4 })
                  : '—'}
              </Td>
              <Td align="right" mono>
                {r.usdc != null && Number.isFinite(r.usdc) ? fmtMoney(r.usdc) : '—'}
              </Td>
              <Td align="right">
                {r.position ? (
                  <LivePnlCell position={r.position} markOf={markOf} />
                ) : r.realizedPnl != null && Number.isFinite(r.realizedPnl) ? (
                  <PnlPill amount={r.realizedPnl} />
                ) : (
                  <span
                    className="text-text-dim"
                    title={
                      isPending(r)
                        ? 'Outcome is known once the market settles on-chain'
                        : undefined
                    }
                  >
                    {isPending(r) ? 'pending' : '—'}
                  </span>
                )}
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge row={r} />
                  {r.settleTxHash && txUrl(r.settleTxHash) && (
                    <a
                      href={txUrl(r.settleTxHash)!}
                      target="_blank"
                      rel="noreferrer"
                      title="View the on-chain payout transaction on Basescan"
                      className="inline-flex items-center gap-1 text-xs text-text-dim transition-colors hover:text-text"
                    >
                      {(r.realizedPnl ?? 0) > 0 ? 'Payout' : 'Settled'}
                      <ExternalLink aria-hidden className="h-3 w-3 opacity-70" />
                    </a>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LivePnlCell({
  position,
  markOf,
}: {
  position: Position;
  markOf: (p: Position) => PositionMark;
}) {
  // markOf() reads the live spot feed via usePositionMarks at the parent, so
  // this cell re-renders as the price ticks without its own subscription.
  const mark = markOf(position);
  if (!Number.isFinite(mark.unrealizedUsd)) {
    return <span className="text-text-dim">—</span>;
  }
  return <PnlPill amount={mark.unrealizedUsd} percent={mark.unrealizedPct} />;
}

/** A settled row: resolved on-chain (has a settlement type or a settle price). */
function isSettledRow(row: MergedRow): boolean {
  const s = row.status.toUpperCase();
  return (
    s === 'SETTLE' ||
    s === 'SETTLED' ||
    s === 'EXERCISE' ||
    (row.settlePrice != null && Number.isFinite(row.settlePrice))
  );
}

/** A filled bet that has neither settled nor remained a live open position. */
function isPending(row: MergedRow): boolean {
  const s = row.status.toUpperCase();
  if (s === 'OPEN' || s === 'CANCEL' || s === 'CANCELLED') return false;
  return !isSettledRow(row);
}

/**
 * Collapse the raw status strings (the DB path emits OPEN/FILLED/SETTLE) into
 * states a user can actually read. A bare "FILLED" left people unable to tell a
 * still-pending bet from a resolved one, so settled rows surface their outcome
 * directly:
 *   OPEN     — live position, marked to market (PnL column ticks)
 *   WON/LOST — settled; PnL column shows the realized figure
 *   SETTLED  — settled, flat/unknown PnL
 *   PENDING  — filled, awaiting on-chain settlement
 *   CANCELLED— offer cancelled
 */
function rowStatus(row: MergedRow): { label: string; cls: string; title?: string } {
  const s = row.status.toUpperCase();

  if (s === 'OPEN') {
    return {
      label: 'OPEN',
      cls: 'bg-brand-light text-brand dark:bg-brand/15 dark:text-brand',
      title: 'Live position — PnL is marked to the current price',
    };
  }
  if (isSettledRow(row)) {
    const pnl = row.realizedPnl;
    if (pnl != null && Number.isFinite(pnl) && pnl > 0)
      return {
        label: 'WON',
        cls: 'bg-pump-light text-pump dark:bg-pump/15 dark:text-pump-dark',
      };
    if (pnl != null && Number.isFinite(pnl) && pnl < 0)
      return {
        label: 'LOST',
        cls: 'bg-dump-light text-dump dark:bg-dump/15 dark:text-dump-dark',
      };
    return { label: 'SETTLED', cls: 'bg-bg-subtle text-text-muted' };
  }
  if (s === 'CANCEL' || s === 'CANCELLED') {
    return {
      label: 'CANCELLED',
      cls: 'bg-dump-light text-dump dark:bg-dump/15 dark:text-dump-dark',
    };
  }
  // FILL / FILLED and anything not yet resolved.
  return {
    label: 'PENDING',
    cls: 'bg-gold/15 text-gold',
    title: 'Bet placed — awaiting on-chain settlement',
  };
}

function StatusBadge({ row }: { row: MergedRow }) {
  const { label, cls, title } = rowStatus(row);
  return (
    <span
      title={title}
      className={cn('rounded-md px-2 py-0.5 text-xs font-bold uppercase', cls)}
    >
      {label}
    </span>
  );
}

function ago(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/**
 * Money formatter that keeps fidelity for sub-cent amounts.
 * fmtUsd rounds to 2dp which collapses $0.0001 → $0.00 — bad for micro-positions.
 */
function fmtMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs === 0) return '$0.00';
  if (abs >= 1000) return fmtUsd(amount, { compact: true });
  const digits = abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPriceCompact(price: number): string {
  if (price >= 1000)
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={'px-4 py-2 ' + (align === 'right' ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
}: {
  children: React.ReactNode;
  align?: 'right';
  mono?: boolean;
}) {
  return (
    <td
      className={
        'px-4 py-3 ' +
        (align === 'right' ? 'text-right ' : 'text-left ') +
        (mono ? 'num tabular-nums ' : '')
      }
    >
      {children}
    </td>
  );
}
