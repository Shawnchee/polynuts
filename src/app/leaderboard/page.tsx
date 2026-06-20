'use client';

import { Activity, Trophy } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { DirectionTag } from '@/components/ui/DirectionTag';
import type { Direction } from '@/lib/sdk/markets';
import {
  useLeaderboardDb,
  type LeaderboardDbRow,
} from '@/lib/sdk/useLeaderboardDb';
import {
  useRecentTradesDb,
  type RecentTradeDbRow,
} from '@/lib/sdk/useRecentTradesDb';
import { hasSupabaseConfigClient } from '@/lib/supabase/browser';
import { fmtTimeAgo, fmtUsd, shortAddress } from '@/lib/utils';

export default function LeaderboardPage() {
  const supabaseReady = hasSupabaseConfigClient();

  return (
    <PageShell active="/leaderboard">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-text">Leaderboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Per-trader rankings — trades, win rate, and realized PnL from Polynuts fills.
          </p>
        </div>

        {supabaseReady && <RecentTrades />}
        {supabaseReady ? <LeaderboardTable /> : <WarmingUp />}
      </div>
    </PageShell>
  );
}

function RecentTrades() {
  const { data, isLoading, error } = useRecentTradesDb();

  // Recent trades are a secondary flourish — the rankings are the primary
  // content. If the query errors or there's nothing yet, render nothing rather
  // than an empty/broken card.
  if (error) return null;
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-bg-elev">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Activity className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-text">Recent trades</h2>
      </div>
      <div className="divide-y divide-line">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <TradeSkeleton key={i} />)
          : data!.map((t) => (
              <TradeRow key={`${t.tx_hash}-${t.option_id}`} trade={t} />
            ))}
      </div>
    </section>
  );
}

function asDirection(side: string | null): Direction | null {
  const s = (side ?? '').toUpperCase();
  return s === 'PUMP' || s === 'DUMP' || s === 'RANGE' ? (s as Direction) : null;
}

function TradeRow({ trade }: { trade: RecentTradeDbRow }) {
  const dir = asDirection(trade.side);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {dir ? (
          <DirectionTag direction={dir} />
        ) : (
          <span className="text-xs font-bold uppercase text-text-dim">—</span>
        )}
        <span className="truncate text-text">{trade.market_label ?? 'Option'}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 tabular-nums">
        <span className="num font-semibold text-text">
          {fmtUsd(Number(trade.notional_usdc))}
        </span>
        <span className="hidden font-mono text-xs text-text-dim sm:inline">
          {shortAddress(trade.taker_address)}
        </span>
        <span className="w-16 text-right text-xs text-text-dim">
          {fmtTimeAgo(trade.created_at)}
        </span>
      </div>
    </div>
  );
}

function TradeSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-14 animate-pulse rounded bg-line" />
        <div className="h-3 w-32 animate-pulse rounded bg-line" />
      </div>
      <div className="h-3 w-16 animate-pulse rounded bg-line" />
    </div>
  );
}

function LeaderboardTable() {
  const { data, isLoading, error } = useLeaderboardDb();

  if (error) {
    return (
      <section className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-bg-elev px-6 py-12 text-center">
        <h2 className="text-md font-semibold text-text">Couldn&apos;t load the leaderboard</h2>
        <p className="max-w-md text-sm text-text-muted">
          Rankings are temporarily unavailable — try again in a moment.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-bg-elev">
      {/* Fixed-width columns overflow narrow phones — let the table scroll
          horizontally instead of crushing the columns, matching the portfolio
          tables' scroll pattern. */}
      <div className="scrollbar-thin overflow-x-auto">
        <div className="min-w-[34rem]">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem] gap-2 border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-dim">
            <div>#</div>
            <div>Trader</div>
            <div className="text-right">Trades</div>
            <div className="text-right">Wins</div>
            <div className="text-right">Win rate</div>
            <div className="text-right">Realized PnL</div>
          </div>
          <div className="divide-y divide-line">
            {isLoading ? (
              <SkeletonRows />
            ) : data && data.length > 0 ? (
              data.map((row, i) => (
                <Row key={row.address} rank={i + 1} row={row} />
              ))
            ) : (
              <div className="px-4 py-12 text-center text-sm text-text-muted">
                No traders ranked yet — the board fills in within a few minutes
                of the first settled trade.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ rank, row }: { rank: number; row: LeaderboardDbRow }) {
  const pnl = Number(row.realized_pnl);
  const finite = Number.isFinite(pnl);
  const pnlClass =
    finite && pnl > 0
      ? 'text-pump dark:text-pump-dark'
      : finite && pnl < 0
      ? 'text-dump dark:text-dump-dark'
      : 'text-text-dim';
  return (
    <div className="grid grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem] items-center gap-2 px-4 py-2.5 text-sm tabular-nums text-text transition-colors hover:bg-surface-hover">
      <div className="num text-text-muted">{rank}</div>
      <div className="truncate font-mono text-text">{shortAddress(row.address)}</div>
      <div className="num text-right">{fmtCount(row.total_trades)}</div>
      <div className="num text-right">{fmtCount(row.wins)}</div>
      <div className="num text-right text-text-muted">
        {row.win_rate == null || !Number.isFinite(row.win_rate)
          ? '—'
          : `${row.win_rate.toFixed(1)}%`}
      </div>
      <div className={`num text-right font-semibold tabular-nums ${pnlClass}`}>
        {!finite || pnl === 0 ? '—' : `${pnl > 0 ? '+' : ''}${fmtUsd(pnl)}`}
      </div>
    </div>
  );
}

function fmtCount(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString() : '—';
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem] gap-2 px-4 py-3"
        >
          <div className="h-3 w-6 animate-pulse rounded bg-line" />
          <div className="h-3 w-40 animate-pulse rounded bg-line" />
          <div className="h-3 w-10 animate-pulse rounded bg-line justify-self-end" />
          <div className="h-3 w-10 animate-pulse rounded bg-line justify-self-end" />
          <div className="h-3 w-12 animate-pulse rounded bg-line justify-self-end" />
          <div className="h-3 w-16 animate-pulse rounded bg-line justify-self-end" />
        </div>
      ))}
    </>
  );
}

function WarmingUp() {
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-bg-elev px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Trophy className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-md font-semibold text-text">Leaderboard is warming up</h2>
      <p className="max-w-md text-sm text-text-muted">
        Per-trader rankings populate once wallets have placed and settled trades
        on Polynuts.
      </p>
    </section>
  );
}
