'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Position, TradeHistory as TradeHistoryEntry } from '@thetanuts-finance/thetanuts-client';
import { usePositions, useTradeHistory } from '@/lib/sdk/usePortfolio';
import { usePositionMarks, type PositionMark } from '@/lib/sdk/usePositionMark';
import { getReadClient } from '@/lib/sdk/clients';
import { getDirectionFromImpl } from '@/lib/sdk/markets';
import { normTx, txUrl } from '@/lib/sdk/explorer';
import { PnlPill } from '@/components/portfolio/PnlPill';
import { TableSkeleton } from '@/components/portfolio/TableSkeleton';
import { PnlCalendar } from '@/components/activity/PnlCalendar';
import {
  computeActivitySummary,
  costBasisHistoryUsd,
  isBuyerSettle,
  isOpen,
  pnlUsd,
  realizedPnlUsd,
  type ActivitySummary,
} from '@/lib/sdk/positionLogic';
import {
  dbBacked,
  useTradeHistoryDb,
  type DbTradeRow,
} from '@/lib/sdk/useTradeHistoryDb';
import type { PnlEntry } from '@/components/activity/PnlCalendar';
import { cn, fmtUsd } from '@/lib/utils';

type ActivityFilter = 'all' | 'PUMP' | 'DUMP' | 'RANGE' | 'wins';
type Direction = 'PUMP' | 'DUMP' | 'RANGE';

const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PUMP', label: 'PUMP' },
  { id: 'DUMP', label: 'DUMP' },
  { id: 'RANGE', label: 'RANGE' },
  { id: 'wins', label: 'Wins' },
];

interface MergedRow {
  key: string;
  ts: number;
  source: 'position' | 'history';
  position?: Position;
  history?: TradeHistoryEntry;
  label: string;
  asset: string;
  direction?: Direction;
  side?: 'buyer' | 'seller';
  contracts?: number;
  usdc?: number;
  entryPrice?: number;
  settlePrice?: number;
  realizedPnl?: number;
  status: string;
  txHash?: string;
  /** On-chain payout (close) tx — Basescan proof the buyer was paid at settlement. */
  settleTxHash?: string;
}

// The "History" section of /portfolio: settled outcomes, lifetime PnL, win
// rate, and the PnL calendar. Carries its own data hooks; the portfolio page
// composes it below the live open-positions table. (The former /activity page,
// which now just redirects here.)
export function TradeHistory() {
  const { address, isConnected } = useAccount();
  const useDb = dbBacked();

  const { data: positions = [], isLoading: posLoading } = usePositions();
  const { data: indexerHistory = [], isLoading: indexerHistLoading } = useTradeHistory();
  const { data: dbRows = [], isLoading: dbLoading } = useTradeHistoryDb();
  const markOf = usePositionMarks();

  const [filter, setFilter] = useState<ActivityFilter>('all');

  const summary = useMemo<ActivitySummary>(() => {
    if (useDb) return summaryFromDbRows(dbRows);
    return computeActivitySummary(
      indexerHistory,
      address,
      (h) => buildLabel(h.option.underlying, h.strikes, getReadClient()),
      positions,
    );
  }, [useDb, dbRows, indexerHistory, address, positions]);

  const merged = useMemo(
    () =>
      useDb
        ? mergeRowsDb(positions, dbRows)
        : mergeRows(positions, indexerHistory, address),
    [useDb, positions, dbRows, indexerHistory, address],
  );

  const calendarEntries = useMemo<PnlEntry[]>(() => {
    if (useDb) {
      return dbRows
        .filter((r) => r.settled_at && r.pnl_usdc != null)
        .map((r) => ({ ts: Date.parse(r.settled_at!), pnl: r.pnl_usdc as number }));
    }
    return indexerHistory
      .filter((h) => isBuyerSettle(h, address))
      .map((h) => ({
        ts: h.timestamp * 1000,
        pnl: realizedPnlUsd(h, positions),
      }))
      .filter((e) => Number.isFinite(e.pnl));
  }, [useDb, dbRows, indexerHistory, address, positions]);

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

  const loading =
    isConnected && (posLoading || (useDb ? dbLoading : indexerHistLoading));
  const openCount = merged.filter((r) => r.status.toUpperCase() === 'OPEN').length;

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

      <SummaryStrip
        summary={summary}
        loading={loading && summary.settledCount === 0}
        connected={isConnected}
      />

      <PnlCalendar entries={calendarEntries} />

      <div className="flex items-center justify-end">
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
 * Collapse the messy raw status strings (indexer emits FILL/SETTLE/EXERCISE;
 * the DB path emits OPEN/FILLED/SETTLE) into states a user can actually read.
 * A bare "FILLED" left people unable to tell a still-pending bet from a
 * resolved one, so settled rows now surface their outcome directly:
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

function mergeRows(
  positions: Position[],
  history: TradeHistoryEntry[],
  address?: string,
): MergedRow[] {
  const client = getReadClient();
  const out: MergedRow[] = [];
  const seenTx = new Set<string>();

  for (const p of positions) {
    if (!isOpen(p)) continue;
    if (!Number.isFinite(pnlUsd(p))) continue;
    seenTx.add(p.entryTxHash.toLowerCase());
    const contracts = safe(() =>
      Number(client.utils.formatAmount(p.amount, p.collateralDecimals || 6, 6))
    );
    const entryPrice = safe(() => Number(client.utils.fromPriceDecimals(p.entryPrice)));
    const usdc =
      contracts != null && entryPrice != null && Number.isFinite(contracts * entryPrice)
        ? contracts * entryPrice
        : undefined;
    out.push({
      key: `pos-${p.id}`,
      ts: Number(p.entryTimestamp) * 1000,
      source: 'position',
      position: p,
      label: buildLabel(p.option.underlying, p.option.strikes, client),
      asset: p.option.underlying,
      direction: directionOfPosition(p),
      side: p.side,
      contracts,
      usdc,
      entryPrice,
      // Indexer open positions report status 'active'; normalize to 'OPEN'.
      status: 'OPEN',
      txHash: p.entryTxHash,
    });
  }

  for (const h of history) {
    if (seenTx.has(h.txHash.toLowerCase()) && h.type === 'fill') continue;
    const dec = h.collateralDecimals || 6;
    const contracts = safe(() => Number(client.utils.formatAmount(h.amount, dec, 6)));
    const price = safe(() => Number(client.utils.fromPriceDecimals(h.price)));
    const settlePrice = h.settlement
      ? safe(() => Number(client.utils.fromPriceDecimals(h.settlement!.settlementPrice)))
      : undefined;
    const realized = isBuyerSettle(h, address)
      ? realizedPnlUsd(h, positions)
      : undefined;
    const indexerCost = isBuyerSettle(h, address)
      ? costBasisHistoryUsd(h, positions)
      : NaN;
    const fallbackCost =
      contracts != null && price != null && Number.isFinite(contracts * price)
        ? contracts * price
        : undefined;
    const cost = Number.isFinite(indexerCost) ? indexerCost : fallbackCost;
    out.push({
      key: `hist-${h.id}-${h.txHash}`,
      ts: h.timestamp * 1000,
      source: 'history',
      history: h,
      label: buildLabel(h.option.underlying, h.strikes, client),
      asset: h.option.underlying,
      direction: directionOf(undefined, h.strikes.length, h.optionTypeRaw),
      side: h.buyer ? 'buyer' : 'seller',
      contracts,
      usdc: cost,
      entryPrice: price,
      settlePrice,
      realizedPnl: realized != null && Number.isFinite(realized) ? realized : undefined,
      status: h.type.toUpperCase(),
      txHash: h.txHash,
      // The CLOSE tx is the payout transfer (the `settle` tx moves no money to
      // the buyer); 0x-prefix the indexer's bare hash for the Basescan link.
      settleTxHash: h.closeTxHash ? '0x' + normTx(h.closeTxHash) : undefined,
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out;
}

/**
 * Build merged rows when the trade history comes from our own Supabase
 * (sync-on-visit). Open positions still come from the indexer (live PnL),
 * but their cost basis / entry price is taken from the matching DB fill —
 * the indexer's entryPrice is an mmPrice (probability-like ~0.005), not the
 * real premium the user paid, so reading it directly shows a near-zero cost.
 */
function mergeRowsDb(
  positions: Position[],
  dbRows: DbTradeRow[],
): MergedRow[] {
  const client = getReadClient();
  const out: MergedRow[] = [];
  const seenTx = new Set<string>();

  // Index DB fills by tx hash so an open position can borrow its real
  // premium (notional) + per-contract entry price. normTx reconciles the
  // indexer's prefix-less hash with our 0x-prefixed DB hash.
  const dbByTx = new Map<string, DbTradeRow>();
  for (const r of dbRows) dbByTx.set(normTx(r.tx_hash), r);

  for (const p of positions) {
    if (!isOpen(p)) continue;
    if (!Number.isFinite(pnlUsd(p))) continue;
    seenTx.add(normTx(p.entryTxHash));
    const contracts = safe(() =>
      Number(client.utils.formatAmount(p.amount, p.collateralDecimals || 6, 6)),
    );
    const db = dbByTx.get(normTx(p.entryTxHash));
    // Prefer the real premium from our DB; fall back to the (wrong but
    // non-null) indexer entryPrice only when there's no matching fill.
    const entryPrice =
      db?.entry_price != null
        ? db.entry_price
        : safe(() => Number(client.utils.fromPriceDecimals(p.entryPrice)));
    const usdc =
      db?.notional_usdc != null && Number.isFinite(db.notional_usdc)
        ? db.notional_usdc
        : contracts != null && entryPrice != null && Number.isFinite(contracts * entryPrice)
        ? contracts * entryPrice
        : undefined;
    out.push({
      key: `pos-${p.id}`,
      ts: Number(p.entryTimestamp) * 1000,
      source: 'position',
      position: p,
      label: buildLabel(p.option.underlying, p.option.strikes, client),
      asset: p.option.underlying,
      direction: directionOfPosition(p),
      side: p.side,
      contracts,
      usdc,
      entryPrice,
      // Indexer open positions report status 'active'; normalize to 'OPEN'
      // so the openCount filter + StatusBadge treat them as live (green).
      status: 'OPEN',
      txHash: p.entryTxHash,
    });
  }

  for (const r of dbRows) {
    // Skip rows that are mirrored by an active position above (avoid dupes
    // for fills that haven't settled yet — the live position is more
    // useful since it has streaming PnL).
    if (seenTx.has(normTx(r.tx_hash))) continue;
    const direction =
      r.side === 'PUMP' || r.side === 'DUMP' || r.side === 'RANGE'
        ? (r.side as Direction)
        : undefined;
    const settled = !!r.settled_at;
    out.push({
      key: `db-${r.id}`,
      ts: settled ? Date.parse(r.settled_at!) : Date.parse(r.created_at),
      source: 'history',
      label: r.market_label ?? '—',
      asset: '',
      direction,
      side: 'buyer',
      contracts: r.contracts,
      usdc: r.notional_usdc || undefined,
      entryPrice: r.entry_price ?? undefined,
      settlePrice: r.settle_price ?? undefined,
      realizedPnl: r.pnl_usdc ?? undefined,
      status: settled ? 'SETTLE' : 'FILLED',
      txHash: r.tx_hash,
      settleTxHash: r.settle_tx_hash ?? undefined,
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out;
}

function summaryFromDbRows(dbRows: DbTradeRow[]): ActivitySummary {
  const settled = dbRows
    .filter((r) => r.settled_at && r.pnl_usdc != null)
    .map((r) => ({
      pnl: r.pnl_usdc as number,
      label: r.market_label ?? '',
      ts: Date.parse(r.settled_at!),
    }))
    .sort((a, b) => b.ts - a.ts);

  let lifetimePnl = 0;
  let wins = 0;
  let bestTrade = 0;
  let bestTradeLabel: string | undefined;
  for (const s of settled) {
    lifetimePnl += s.pnl;
    if (s.pnl > 0) wins++;
    if (s.pnl > bestTrade) {
      bestTrade = s.pnl;
      bestTradeLabel = s.label;
    }
  }
  let streak = 0;
  for (const s of settled) {
    if (s.pnl > 0) streak++;
    else break;
  }
  return {
    lifetimePnl,
    winRate: settled.length ? wins / settled.length : 0,
    settledCount: settled.length,
    wins,
    bestTrade,
    bestTradeLabel,
    streak,
  };
}

function buildLabel(
  underlying: string,
  strikes: bigint[],
  client: ReturnType<typeof getReadClient>
): string {
  const fmt = (s: bigint) =>
    `$${Number(client.utils.fromStrikeDecimals(s)).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  return `${underlying} ${strikes.map(fmt).join(' / ')}`;
}

function directionOf(
  optionType: number | undefined,
  strikeCount: number,
  raw?: number
): Direction | undefined {
  const t = optionType ?? raw;
  if (t == null) {
    if (strikeCount >= 2) return 'RANGE';
    return undefined;
  }
  // Matches sideFromOptionType in src/lib/supabase/sync.ts — must stay in sync
  // with what is stored in the DB so the non-DB (indexer) path shows the same labels.
  if (t === 0 || t === 3) return 'PUMP';
  if (t === 1 || t === 4) return 'DUMP';
  if (t === 2 || t === 5) return 'RANGE';
  return undefined;
}

/**
 * Direction of an OPEN position. The indexer's `option.optionType` is the
 * base-leg type (call = 0) for multi-leg structures, so a put spread (DUMP)
 * misreads as PUMP if you trust it. Prefer the implementation name
 * (authoritative — e.g. PUT_SPREAD → DUMP), then the raw option type, then
 * the structured type as a last resort. Mirrors `isCallFamily` in positionLogic.
 */
function directionOfPosition(p: Position): Direction | undefined {
  if (p.implementationName) {
    const d = getDirectionFromImpl(p.implementationName);
    if (d) return d;
  }
  return directionOf(p.optionTypeRaw ?? p.option.optionType, p.option.strikes.length);
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
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
