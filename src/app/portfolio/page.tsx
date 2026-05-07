'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';
import { PageShell } from '@/components/layout/PageShell';
import { PnlPill } from '@/components/portfolio/PnlPill';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { usePositions, useTradeHistory } from '@/lib/sdk/usePortfolio';
import { fmtUsd, shortAddress } from '@/lib/utils';

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();
  const { data: positions = [], isLoading: posLoading } = usePositions();
  const { data: history = [], isLoading: histLoading } = useTradeHistory();

  const summary = useMemo(() => buildSummary(positions, history), [positions, history]);

  if (!isConnected) {
    return (
      <PageShell active="/portfolio">
        <ConnectGate />
      </PageShell>
    );
  }

  return (
    <PageShell active="/portfolio">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-text">Portfolio</h1>
          <p className="num mt-1 text-sm text-text-muted">{shortAddress(address ?? '')}</p>
        </div>

        <SummaryBar summary={summary} loading={posLoading || histLoading} />

        <Section
          title="Open Positions"
          count={positions.length}
          loading={posLoading}
          empty="No open positions yet."
        >
          {positions.length > 0 && <PositionsTable rows={positions} />}
        </Section>

        <Section
          title="Settled History"
          count={history.length}
          loading={histLoading}
          empty="Settled trades will show up here once orders have expired."
        >
          {history.length > 0 && <HistoryTable rows={history} />}
        </Section>
      </div>
    </PageShell>
  );
}

function ConnectGate() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line bg-bg-elev p-12">
      <h1 className="text-xl font-bold text-text">Connect your wallet</h1>
      <p className="max-w-sm text-center text-sm text-text-muted">
        Sign in to see your open positions, settled history, and P&amp;L.
      </p>
      <ConnectButton />
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Back to Markets
      </Link>
    </div>
  );
}

interface Summary {
  totalPnl: number;
  winRate: number;
  totalBets: number;
  biggestWin: number;
}

function buildSummary(positions: Position[], history: TradeHistory[]): Summary {
  let totalPnl = 0;
  for (const p of positions) totalPnl += Number(p.pnl) / 1e6;
  const settled = history.filter((h) => h.type === 'settle' || h.type === 'exercise');
  let realized = 0;
  let biggestWin = 0;
  let wins = 0;
  for (const h of settled) {
    const dec = h.collateralDecimals || 6;
    const value = Number(h.amount) / 10 ** dec;
    if (value > 0) wins++;
    if (value > biggestWin) biggestWin = value;
    realized += value;
  }
  totalPnl += realized;
  const total = history.length;
  const winRate = total > 0 ? wins / total : 0;
  return { totalPnl, winRate, totalBets: total, biggestWin };
}

function SummaryBar({ summary, loading }: { summary: Summary; loading: boolean }) {
  const cells: { label: string; value: string; tone?: 'pnl' }[] = [
    { label: 'Total P&L', value: fmtUsd(summary.totalPnl), tone: 'pnl' },
    { label: 'Win Rate', value: `${Math.round(summary.winRate * 100)}%` },
    { label: 'Total Bets', value: summary.totalBets.toString() },
    { label: 'Biggest Win', value: fmtUsd(summary.biggestWin) },
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
          <div className="num mt-1 text-lg font-bold tabular-nums text-text">
            {loading ? '…' : c.tone === 'pnl' ? <PnlPill amount={summary.totalPnl} /> : c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  loading,
  empty,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-bg-elev animate-fade-in">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-semibold text-text">{title}</h2>
          <span className="num text-sm text-text-dim">{count}</span>
        </div>
      </div>
      {loading ? (
        <div className="px-4 py-12 text-center text-sm text-text-dim">Loading…</div>
      ) : count === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-text-dim">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}

function PositionsTable({ rows }: { rows: Position[] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-bg-subtle text-left">
          <tr className="label text-text-muted">
            <Th>Position</Th>
            <Th>Side</Th>
            <Th align="right">Contracts</Th>
            <Th align="right">Entry</Th>
            <Th align="right">PnL</Th>
            <Th align="right">Expires</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-surface-hover">
              <Td>
                <span className="font-medium text-text">{p.option.underlying}</span>
                <span className="ml-2 text-text-dim">
                  {p.option.strikes.map((s) => `$${(Number(s) / 1e8).toLocaleString()}`).join(' / ')}
                </span>
              </Td>
              <Td>
                <span
                  className={
                    p.side === 'buyer'
                      ? 'font-semibold uppercase text-pump dark:text-pump-dark'
                      : 'font-semibold uppercase text-dump dark:text-dump-dark'
                  }
                >
                  {p.side === 'buyer' ? 'YES' : 'NO'}
                </span>
              </Td>
              <Td align="right" mono>
                {(Number(p.amount) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </Td>
              <Td align="right" mono>
                {fmtUsd(Number(p.entryPrice) / 1e8, { compact: true })}
              </Td>
              <Td align="right">
                <PnlPill amount={Number(p.pnl) / 1e6} />
              </Td>
              <Td align="right">
                <TimerBadge expirySec={p.option.expiry} />
              </Td>
              <Td>
                <span className="rounded-md bg-bg-subtle px-2 py-0.5 text-xs uppercase text-text-muted">
                  {p.status}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ rows }: { rows: TradeHistory[] }) {
  const sorted = [...rows].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-bg-subtle text-left">
          <tr className="label text-text-muted">
            <Th>Time</Th>
            <Th>Type</Th>
            <Th>Asset</Th>
            <Th align="right">Amount</Th>
            <Th align="right">Price</Th>
            <Th>Tx</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((h) => (
            <tr key={`${h.id}-${h.txHash}`} className="transition-colors hover:bg-surface-hover">
              <Td>
                <span className="num text-text-muted">
                  {new Date(h.timestamp * 1000).toLocaleString()}
                </span>
              </Td>
              <Td>
                <span className="uppercase text-text">{h.type}</span>
              </Td>
              <Td>{h.option.underlying}</Td>
              <Td align="right" mono>
                {(Number(h.amount) / 10 ** (h.collateralDecimals || 6)).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </Td>
              <Td align="right" mono>
                {fmtUsd(Number(h.price) / 1e8, { compact: true })}
              </Td>
              <Td>
                <a
                  className="text-brand hover:underline"
                  href={`https://basescan.org/tx/${h.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(h.txHash, 8, 6)}
                </a>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
