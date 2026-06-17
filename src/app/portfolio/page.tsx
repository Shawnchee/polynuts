'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import { PageShell } from '@/components/layout/PageShell';
import { PnlPill } from '@/components/portfolio/PnlPill';
import { TableSkeleton } from '@/components/portfolio/TableSkeleton';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { usePositions } from '@/lib/sdk/usePortfolio';
import { usePositionMarks, type PositionMark } from '@/lib/sdk/usePositionMark';
import { TradeHistory } from '@/components/portfolio/TradeHistory';
import { getReadClient } from '@/lib/sdk/clients';
import { txUrl } from '@/lib/sdk/explorer';
import { hasFinitePnl, isOpen } from '@/lib/sdk/positionLogic';
import { fmtUsd, shortAddress } from '@/lib/utils';

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();
  const { data: positions = [], isLoading: posLoading } = usePositions();
  const markOf = usePositionMarks();

  const openPositions = useMemo(() => positions.filter(isOpen).filter(hasFinitePnl), [positions]);
  const current = useMemo(() => buildCurrent(openPositions, markOf), [openPositions, markOf]);

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

        <CurrentBar current={current} loading={posLoading} />

        <Section
          title="Open Positions"
          count={openPositions.length}
          loading={posLoading}
          empty={<EmptyPositions />}
          skeleton={<TableSkeleton cols={7} rows={3} />}
        >
          {openPositions.length > 0 && (
            <PositionsTable rows={openPositions} markOf={markOf} />
          )}
        </Section>

        {/* Settled outcomes, lifetime PnL, win rate and the PnL calendar — the
            former /activity page, now stacked under live positions. */}
        <TradeHistory />
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

interface Current {
  openCount: number;
  exposure: number;
  unrealizedPnl: number;
  /** How many open positions we could mark to market this tick. */
  markedCount: number;
}

function buildCurrent(
  positions: Position[],
  markOf: (p: Position) => PositionMark,
): Current {
  let exposure = 0;
  let unrealizedPnl = 0;
  let markedCount = 0;
  for (const p of positions) {
    const m = markOf(p);
    if (Number.isFinite(m.premiumUsd)) exposure += m.premiumUsd;
    if (Number.isFinite(m.unrealizedUsd)) {
      unrealizedPnl += m.unrealizedUsd;
      markedCount++;
    }
  }
  return { openCount: positions.length, exposure, unrealizedPnl, markedCount };
}

function CurrentBar({ current, loading }: { current: Current; loading: boolean }) {
  if (loading) return <CurrentSkeleton />;
  const cells: { label: string; value: React.ReactNode; sub?: string }[] = [
    {
      label: 'Open Positions',
      value: (
        <span className="num font-bold tabular-nums text-text">{current.openCount}</span>
      ),
    },
    {
      label: 'Open Exposure',
      value: (
        <span className="num font-bold tabular-nums text-text">{fmtUsd(current.exposure)}</span>
      ),
      sub: 'cost basis',
    },
    {
      label: 'Unrealized PnL',
      value:
        current.markedCount > 0 ? (
          <PnlPill amount={current.unrealizedPnl} />
        ) : (
          <span className="text-text-dim">—</span>
        ),
      sub:
        current.openCount > 0 && current.markedCount < current.openCount
          ? current.markedCount === 0
            ? 'awaiting live price'
            : `${current.markedCount} of ${current.openCount} marked`
          : current.markedCount > 0
          ? 'marked to live price'
          : undefined,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="card-lift rounded-xl border border-line bg-bg-elev px-4 py-3 animate-fade-in"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="label text-text-dim">{c.label}</div>
          <div className="mt-1 text-lg leading-tight">{c.value}</div>
          {c.sub && <div className="mt-0.5 text-xs text-text-dim">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function CurrentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-bg-elev px-4 py-3 animate-pulse"
        >
          <div className="h-3 w-20 rounded bg-bg-subtle" />
          <div className="mt-2 h-5 w-24 rounded bg-bg-subtle" />
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
  skeleton,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  empty: React.ReactNode;
  skeleton: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-bg-elev animate-fade-in">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-semibold text-text">{title}</h2>
          <span className="num text-sm tabular-nums text-text-dim">
            {loading ? '' : count}
          </span>
        </div>
      </div>
      {loading ? skeleton : count === 0 ? empty : children}
    </section>
  );
}

function EmptyPositions() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      <p className="text-md font-medium text-text">No positions yet</p>
      <p className="max-w-sm text-sm text-text-muted">
        Place a bet and your open positions, exposure, and live P&amp;L will show up here.
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

function PositionsTable({
  rows,
  markOf,
}: {
  rows: Position[];
  markOf: (p: Position) => PositionMark;
}) {
  const client = getReadClient();
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
          {rows.map((p) => {
            const mark = markOf(p);
            return (
              <tr key={p.id} className="transition-colors hover:bg-surface-hover">
                <Td>
                  <span className="font-medium text-text">{p.option.underlying}</span>
                  <span className="ml-2 text-text-dim">
                    {p.option.strikes
                      .map(
                        (s) =>
                          `$${Number(
                            client.utils.fromStrikeDecimals(s)
                          ).toLocaleString()}`
                      )
                      .join(' / ')}
                  </span>
                  {txUrl(p.entryTxHash) && (
                    <a
                      href={txUrl(p.entryTxHash)!}
                      target="_blank"
                      rel="noreferrer"
                      title="View entry transaction on Basescan"
                      className="ml-1.5 inline-flex translate-y-px text-text-dim transition-colors hover:text-text"
                    >
                      <ExternalLink aria-hidden className="h-3 w-3" />
                    </a>
                  )}
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
                  {Number(
                    client.utils.formatAmount(p.amount, p.collateralDecimals || 6, 4)
                  ).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </Td>
                <Td align="right" mono>
                  {Number.isFinite(mark.entryPerContractUsd)
                    ? fmtUsd(mark.entryPerContractUsd, { compact: true })
                    : '—'}
                </Td>
                <Td align="right">
                  <PnlPill amount={mark.unrealizedUsd} percent={mark.unrealizedPct} />
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
            );
          })}
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
