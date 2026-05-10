'use client';

import { Trophy } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import {
  useBookDailyStats,
  reduceDailyStats,
} from '@/lib/sdk/useLeaderboard';
import { fmtUsd } from '@/lib/utils';

export default function LeaderboardPage() {
  // Lifetime protocol stats come from the indexer (getBookDailyStats) and
  // load reliably. The per-trader leaderboard table previously scanned
  // OrderFillEvent logs over a 43k–95k block window, which exceeds the
  // 10-block eth_getLogs cap on Alchemy's free tier — every request
  // failed. Until we either move to a paid RPC tier or stand up a per-
  // trader indexer endpoint, the table is replaced with a placeholder.
  const { data: dailyStats } = useBookDailyStats();
  const protocol = reduceDailyStats(dailyStats);

  return (
    <PageShell active="/leaderboard">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-text">Leaderboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Lifetime protocol stats from the Thetanuts indexer. Per-trader rankings coming soon.
          </p>
        </div>

        <ProtocolStrip
          totalTrades={protocol.totalTrades}
          totalVolumeUsd={protocol.totalVolumeUsd}
          daysCovered={protocol.daysCovered}
          latestDate={protocol.latestDate}
        />

        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-bg-elev px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Trophy className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="text-md font-semibold text-text">Per-trader leaderboard — coming soon</h2>
          <p className="max-w-md text-sm text-text-muted">
            We&apos;re building an indexer to rank traders by notional and fill count.
            Lifetime protocol totals above update every 5 minutes.
          </p>
        </section>
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

