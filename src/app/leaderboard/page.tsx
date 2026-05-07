'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PageShell } from '@/components/layout/PageShell';
import {
  useLeaderboard,
  useBookDailyStats,
  reduceDailyStats,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from '@/lib/sdk/useLeaderboard';
import { cn, shortAddress, fmtUsd } from '@/lib/utils';

const periods: { id: LeaderboardPeriod; label: string; sub: string }[] = [
  { id: 'day', label: '24h', sub: 'last day' },
  { id: 'week', label: 'Recent', sub: 'last ~2 days' },
];

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('day');
  const { data: rows = [], isLoading, error } = useLeaderboard(period);
  const { data: dailyStats } = useBookDailyStats();
  const protocol = reduceDailyStats(dailyStats);
  const { address } = useAccount();

  const myAddr = address?.toLowerCase();
  const myIdx = rows.findIndex((r) => r.address === myAddr);

  return (
    <PageShell active="/leaderboard">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text">Leaderboard</h1>
            <p className="mt-1 text-sm text-text-muted">
              Ranked by USDC notional traded as taker on the Thetanuts OptionBook.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-line bg-bg-elev p-1">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'press-scale rounded-sm px-3 py-1.5 text-sm font-medium transition-all duration-180',
                  period === p.id
                    ? 'bg-text text-bg-elev'
                    : 'text-text-muted hover:text-text'
                )}
                title={p.sub}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <ProtocolStrip
          totalTrades={protocol.totalTrades}
          totalVolumeUsd={protocol.totalVolumeUsd}
          daysCovered={protocol.daysCovered}
          latestDate={protocol.latestDate}
        />

        <section className="overflow-hidden rounded-xl border border-line bg-bg-elev">
          <div className="grid grid-cols-[64px_1fr_120px_140px_120px] items-center border-b border-line bg-bg-subtle px-4 py-2.5 text-left">
            <span className="label text-text-muted">Rank</span>
            <span className="label text-text-muted">Trader</span>
            <span className="label text-right text-text-muted">Fills</span>
            <span className="label text-right text-text-muted">Notional</span>
            <span className="label text-right text-text-muted">Badge</span>
          </div>

          {isLoading && <Loading />}
          {error != null && (
            <div className="px-4 py-12 text-center text-sm text-dump dark:text-dump-dark">
              Couldn&apos;t fetch on-chain fills — RPC rate-limited or unreachable.
            </div>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-text-dim">
              No fills in this window yet — be the first.
            </div>
          )}
          {!isLoading && !error && rows.length > 0 && (
            <ul className="divide-y divide-line">
              {rows.map((row, i) => (
                <Row
                  key={row.address}
                  rank={i + 1}
                  row={row}
                  isMe={!!myAddr && row.address === myAddr}
                />
              ))}
            </ul>
          )}

          {myAddr && myIdx === -1 && !isLoading && rows.length > 0 && (
            <div className="border-t border-line bg-brand/10 px-4 py-3 text-sm text-text-muted">
              You haven&apos;t placed a fill in this window yet.
            </div>
          )}
        </section>

        <p className="text-xs text-text-dim">
          Note: per-trader fills are scanned from on-chain events with the SDK&apos;s
          ~100K-block chunked limit (≈ 2 days on Base). Lifetime protocol totals
          come from the indexer-side <span className="num">getBookDailyStats</span>.
        </p>
      </div>
    </PageShell>
  );
}

function ProtocolStrip({
  totalTrades,
  totalVolumeUsd,
  daysCovered,
  latestDate,
}: {
  totalTrades: number;
  totalVolumeUsd: number;
  daysCovered: number;
  latestDate: string | null;
}) {
  const cells = [
    {
      label: 'Lifetime Volume',
      value: totalVolumeUsd > 0 ? fmtUsd(totalVolumeUsd, { compact: true }) : '—',
    },
    {
      label: 'Lifetime Trades',
      value: totalTrades > 0 ? totalTrades.toLocaleString() : '—',
    },
    {
      label: 'Days Indexed',
      value: daysCovered > 0 ? daysCovered.toString() : '—',
    },
    {
      label: 'Latest Day',
      value: latestDate ?? '—',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="card-lift rounded-xl border border-line bg-bg-elev px-4 py-3 animate-fade-in"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="label text-text-dim">{c.label}</div>
          <div className="num mt-1 text-md font-bold tabular-nums text-text">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({
  rank,
  row,
  isMe,
}: {
  rank: number;
  row: LeaderboardRow;
  isMe: boolean;
}) {
  const notional = Number(row.notional) / 1e6;
  const badge = inferBadge(rank, row);
  return (
    <li
      className={cn(
        'grid animate-fade-in grid-cols-[64px_1fr_120px_140px_120px] items-center px-4 py-3 transition-colors duration-180',
        isMe ? 'bg-brand/10' : 'hover:bg-surface-hover'
      )}
    >
      <span className="num text-md font-bold tabular-nums text-text">#{rank}</span>
      <span className="num text-sm text-text">
        {shortAddress(row.address)}
        {isMe && (
          <span className="ml-2 rounded-md bg-brand px-1.5 py-0.5 text-xs uppercase text-white">
            you
          </span>
        )}
      </span>
      <span className="num text-right text-sm tabular-nums text-text">{row.fills}</span>
      <span className="num text-right text-sm font-semibold tabular-nums text-text">
        {fmtUsd(notional, { compact: true })}
      </span>
      <span className="text-right text-xs">
        {badge && (
          <span className="inline-block rounded-md bg-bg-subtle px-2 py-0.5 uppercase text-text-muted">
            {badge}
          </span>
        )}
      </span>
    </li>
  );
}

function inferBadge(rank: number, row: LeaderboardRow): string | null {
  if (rank === 1) return 'Pump King';
  if (rank === 2) return 'Diamond Hands';
  if (rank === 3) return 'Condor Lord';
  if (row.fills >= 20) return `${row.fills} fills`;
  if (row.fills >= 5) return 'Degen';
  return null;
}

function Loading() {
  return (
    <ul className="divide-y divide-line">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[64px_1fr_120px_140px_120px] items-center px-4 py-4"
        >
          <div className="h-3 w-8 animate-pulse rounded bg-bg-subtle" />
          <div className="h-3 w-32 animate-pulse rounded bg-bg-subtle" />
          <div className="h-3 w-12 animate-pulse rounded bg-bg-subtle justify-self-end" />
          <div className="h-3 w-20 animate-pulse rounded bg-bg-subtle justify-self-end" />
          <div className="h-3 w-14 animate-pulse rounded bg-bg-subtle justify-self-end" />
        </li>
      ))}
    </ul>
  );
}
