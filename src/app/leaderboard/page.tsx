'use client';

import { useMemo, useState } from 'react';
import { Activity, Search, Trophy } from 'lucide-react';
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
import { cn, fmtTimeAgo, fmtUsd, shortAddress } from '@/lib/utils';

// Top-3 medals — glossy 3D place medals (Microsoft Fluent Emoji, MIT) in
// public/medals, with a matching metallic tint for the faint row highlight.
const MEDALS = [
  { src: '/medals/gold.png', tint: '#F59E0B' },
  { src: '/medals/silver.png', tint: '#9CA9B8' },
  { src: '/medals/bronze.png', tint: '#C8814B' },
];

type SortKey = 'pnl' | 'winRate' | 'trades';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'pnl', label: 'Realized PnL' },
  { id: 'winRate', label: 'Win rate' },
  { id: 'trades', label: 'Trades' },
];

const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function LeaderboardPage() {
  const supabaseReady = hasSupabaseConfigClient();

  return (
    <PageShell active="/leaderboard">
      <div className="flex flex-col gap-6">
        <LeaderboardHeader />
        {supabaseReady && <RecentTrades />}
        {supabaseReady ? <LeaderboardBoard /> : <WarmingUp />}
      </div>
    </PageShell>
  );
}

// Editorial header with a faint product motif — a candlestick-grid wash that
// echoes the landing page without pulling in its WebGL background.
function LeaderboardHeader() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-bg-elev px-5 py-5 sm:px-6 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            'radial-gradient(120% 100% at 100% 0%, rgb(var(--brand-rgb,37 99 235) / 0.10), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--line) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Trophy className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Leaderboard</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Per-trader rankings — trades, win rate, and realized PnL from Polynuts fills.
          </p>
        </div>
      </div>
    </div>
  );
}

function RecentTrades() {
  const { data, isLoading, error } = useRecentTradesDb();

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

function LeaderboardBoard() {
  const { data, isLoading, error } = useLeaderboardDb();
  const [sort, setSort] = useState<SortKey>('pnl');
  const [activeOnly, setActiveOnly] = useState(false);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const trades = rows.reduce((s, r) => s + (r.total_trades || 0), 0);
    const pnl = rows.reduce((s, r) => s + (Number(r.realized_pnl) || 0), 0);
    return { traders: rows.length, trades, pnl };
  }, [rows]);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const filtered = rows.filter((r) => {
      if (q && !r.address.toLowerCase().includes(q)) return false;
      if (activeOnly) {
        if (!r.last_trade_at) return false;
        if (now - Date.parse(r.last_trade_at) > ACTIVE_WINDOW_MS) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'trades') return b.total_trades - a.total_trades;
      if (sort === 'winRate') return rank(b.win_rate) - rank(a.win_rate);
      return Number(b.realized_pnl) - Number(a.realized_pnl);
    });
    return sorted;
  }, [rows, query, activeOnly, sort]);

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
    <section className="flex flex-col gap-4">
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip label="Ranked traders" value={isLoading ? '—' : stats.traders.toLocaleString()} />
        <StatChip label="Total trades" value={isLoading ? '—' : stats.trades.toLocaleString()} />
        <StatChip
          label="Net realized PnL"
          value={isLoading ? '—' : fmtUsd(stats.pnl, { compact: true })}
          tone={stats.pnl > 0 ? 'up' : stats.pnl < 0 ? 'down' : 'flat'}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-elev p-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                sort === s.id
                  ? 'bg-brand text-white'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveOnly((v) => !v)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              activeOnly
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-line bg-bg-elev text-text-muted hover:text-text',
            )}
          >
            Active 7d
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address…"
              className="w-full rounded-lg border border-line bg-bg-elev py-1.5 pl-8 pr-3 text-sm text-text placeholder:text-text-dim focus:border-brand/40 focus:outline-none sm:w-52"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-bg-elev">
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
              ) : view.length > 0 ? (
                view.map((row, i) => <Row key={row.address} rank={i + 1} row={row} />)
              ) : (
                <div className="px-4 py-12 text-center text-sm text-text-muted">
                  {rows.length === 0
                    ? 'No traders ranked yet — the board fills in within a few minutes of the first settled trade.'
                    : 'No traders match your filters.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Sort key for win rate that pushes nulls (no settled trades) to the bottom. */
function rank(winRate: number | null): number {
  return winRate == null || !Number.isFinite(winRate) ? -1 : winRate;
}

function StatChip({
  label,
  value,
  tone = 'flat',
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  const valueCls =
    tone === 'up'
      ? 'text-pump dark:text-pump-dark'
      : tone === 'down'
      ? 'text-dump dark:text-dump-dark'
      : 'text-text';
  return (
    <div className="rounded-xl border border-line bg-bg-elev px-3.5 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={cn('mt-1 text-lg font-bold tabular-nums', valueCls)}>{value}</div>
    </div>
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
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  return (
    <div
      className="grid grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem] items-center gap-2 px-4 py-2.5 text-sm tabular-nums text-text transition-colors hover:bg-surface-hover"
      style={medal ? { background: `${medal.tint}14` } : undefined}
    >
      <div className="flex items-center">
        {medal ? (
          // Tiny static local PNG — next/image adds no value here (see TokenIcon).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={medal.src}
            alt={`Rank ${rank}`}
            width={26}
            height={26}
            className="h-[26px] w-[26px] shrink-0 object-contain"
          />
        ) : (
          <span className="num text-text-muted">{rank}</span>
        )}
      </div>
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
