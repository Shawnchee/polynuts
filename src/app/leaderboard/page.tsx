'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PageShell } from '@/components/layout/PageShell';
import { useLeaderboard, type LeaderboardPeriod, type LeaderboardRow } from '@/lib/sdk/useLeaderboard';
import { cn, shortAddress, fmtUsd } from '@/lib/utils';

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'all', label: 'All-time' },
];

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const { data: rows = [], isLoading, error } = useLeaderboard(period);
  const { address } = useAccount();

  const myAddr = address?.toLowerCase();
  const myIdx = rows.findIndex((r) => r.address === myAddr);

  return (
    <PageShell active="/leaderboard">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-ink-900">Leaderboard</h1>
          <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white p-1">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  period === p.id
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
          <div className="grid grid-cols-[64px_1fr_120px_140px_120px] items-center border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-left">
            <span className="label text-ink-600">Rank</span>
            <span className="label text-ink-600">Trader</span>
            <span className="label text-right text-ink-600">Fills</span>
            <span className="label text-right text-ink-600">Notional</span>
            <span className="label text-right text-ink-600">Badge</span>
          </div>

          {isLoading && <Loading />}
          {error != null && (
            <div className="px-4 py-12 text-center text-sm text-dump">
              Couldn&apos;t fetch on-chain fills — RPC rate-limited or unreachable.
            </div>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-ink-400">
              No fills in this window yet — be the first.
            </div>
          )}
          {!isLoading && !error && rows.length > 0 && (
            <ul className="divide-y divide-ink-200">
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

          {myAddr && myIdx === -1 && !isLoading && (
            <div className="border-t border-ink-200 bg-brand-light px-4 py-3 text-sm text-ink-600">
              You haven&apos;t placed a fill in this window yet.
            </div>
          )}
        </section>
      </div>
    </PageShell>
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
        'grid grid-cols-[64px_1fr_120px_140px_120px] items-center px-4 py-3',
        isMe && 'bg-brand-light'
      )}
    >
      <span className="num text-md font-bold tabular-nums text-ink-900">
        {rank <= 3 ? medal(rank) : `#${rank}`}
      </span>
      <span className="num text-sm text-ink-900">
        {shortAddress(row.address)}
        {isMe && (
          <span className="ml-2 rounded-sm bg-brand px-1.5 py-0.5 text-xs uppercase text-white">
            you
          </span>
        )}
      </span>
      <span className="num text-right text-sm tabular-nums text-ink-900">
        {row.fills}
      </span>
      <span className="num text-right text-sm font-semibold tabular-nums text-ink-900">
        {fmtUsd(notional, { compact: true })}
      </span>
      <span className="text-right text-xs">
        {badge && (
          <span className="inline-block rounded-sm bg-ink-100 px-2 py-0.5 uppercase text-ink-600">
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

function medal(rank: number): string {
  if (rank === 1) return '#1';
  if (rank === 2) return '#2';
  if (rank === 3) return '#3';
  return `#${rank}`;
}

function Loading() {
  return (
    <ul className="divide-y divide-ink-200">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[64px_1fr_120px_140px_120px] items-center px-4 py-4"
        >
          <div className="h-3 w-8 animate-pulse rounded bg-ink-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-ink-200" />
          <div className="h-3 w-12 animate-pulse rounded bg-ink-200 justify-self-end" />
          <div className="h-3 w-20 animate-pulse rounded bg-ink-200 justify-self-end" />
          <div className="h-3 w-14 animate-pulse rounded bg-ink-200 justify-self-end" />
        </li>
      ))}
    </ul>
  );
}
