'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { useRecentTradesDb } from '@/lib/sdk/useRecentTradesDb';
import type { Direction } from '@/lib/sdk/markets';
import { cn, fmtUsd } from '@/lib/utils';

/**
 * Thin ambient "tape" under the filter strip — a Bloomberg-style crawl of
 * READ-ONLY market signal: live BTC/ETH spot (Deribit) followed by the most
 * recent real fills on Polynuts. Motion belongs here precisely because none
 * of it is a click target — the clickable "hot markets" live in a static,
 * cursor-stable pill rail in the hero. Auto-scrolls, pauses on hover, and
 * respects prefers-reduced-motion.
 */

interface Spot {
  asset: 'BTC' | 'ETH';
  price: number;
  change: number; // 24h % change
}

const INSTRUMENTS: { asset: Spot['asset']; instrument: string }[] = [
  { asset: 'BTC', instrument: 'BTC-PERPETUAL' },
  { asset: 'ETH', instrument: 'ETH-PERPETUAL' },
];

async function fetchSpot(asset: Spot['asset'], instrument: string): Promise<Spot> {
  const res = await fetch(
    `https://www.deribit.com/api/v2/public/ticker?instrument_name=${instrument}`
  );
  if (!res.ok) throw new Error(`Deribit ${res.status}`);
  const json = await res.json();
  const r = json.result ?? {};
  return {
    asset,
    price: Number(r.last_price ?? r.index_price ?? 0),
    change: Number(r.stats?.price_change ?? 0),
  };
}

function asDirection(side: string | null): Direction | null {
  const s = (side ?? '').toUpperCase();
  return s === 'PUMP' || s === 'DUMP' || s === 'RANGE' ? (s as Direction) : null;
}

function dirTextCls(dir: Direction | null): string {
  if (dir === 'PUMP') return 'text-pump dark:text-pump-dark';
  if (dir === 'DUMP') return 'text-dump dark:text-dump-dark';
  if (dir === 'RANGE') return 'text-range dark:text-range-dark';
  return 'text-text-dim';
}

function dirDotCls(dir: Direction | null): string {
  if (dir === 'PUMP') return 'bg-pump';
  if (dir === 'DUMP') return 'bg-dump';
  if (dir === 'RANGE') return 'bg-range';
  return 'bg-text-dim';
}

function TickerRow({
  nodes,
  hidden,
}: {
  nodes: React.ReactNode[];
  hidden?: boolean;
}) {
  return (
    <div
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-8 pr-8 text-xs"
    >
      {nodes.map((node, i) => (
        <span key={i} className="inline-flex items-center">
          {node}
        </span>
      ))}
    </div>
  );
}

export function MarketTicker() {
  const { data: spot } = useQuery({
    queryKey: ['deribit-spot'],
    queryFn: () =>
      Promise.all(INSTRUMENTS.map((i) => fetchSpot(i.asset, i.instrument))),
    refetchInterval: 20_000,
    staleTime: 15_000,
    retry: 1,
  });
  const { data: trades } = useRecentTradesDb(12);

  const items = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    (spot ?? []).forEach((s) => {
      const up = s.change >= 0;
      nodes.push(
        <span
          key={`spot-${s.asset}`}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <TokenIcon asset={s.asset} size={14} />
          <span className="num font-semibold tabular-nums text-text">
            {`$${s.price.toLocaleString('en-US', {
              maximumFractionDigits: s.price >= 1000 ? 0 : 2,
            })}`}
          </span>
          <span
            className={cn(
              'num tabular-nums',
              up ? 'text-pump dark:text-pump-dark' : 'text-dump dark:text-dump-dark'
            )}
          >
            {up ? '▲' : '▼'} {Math.abs(s.change).toFixed(2)}%
          </span>
        </span>
      );
    });
    (trades ?? []).forEach((t, i) => {
      const dir = asDirection(t.side);
      nodes.push(
        <span
          key={`fill-${t.tx_hash}-${t.option_id}-${i}`}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-muted"
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', dirDotCls(dir))} />
          <span className="truncate">{t.market_label ?? 'Option'}</span>
          {dir && (
            <span className={cn('font-semibold uppercase tracking-wide', dirTextCls(dir))}>
              {dir}
            </span>
          )}
          <span className="num font-semibold tabular-nums text-text">
            {fmtUsd(Number(t.notional_usdc))}
          </span>
        </span>
      );
    });
    return nodes;
  }, [spot, trades]);

  // Nothing to show yet (spot still loading, no fills) — reserve the bar
  // height so the layout below doesn't jump when the tape fills in.
  const empty = items.length === 0;

  return (
    <div className="group border-b border-line bg-bg-elev/60 backdrop-blur">
      <div className="relative mx-auto flex h-9 max-w-page items-center overflow-hidden px-4 sm:px-6">
        {empty ? (
          <span className="text-xs text-text-dim">Loading market tape…</span>
        ) : (
          <div className="flex w-max animate-marquee items-center motion-reduce:animate-none group-hover:[animation-play-state:paused]">
            {/* Two identical copies; the -50% marquee translate loops one copy
                width for a seamless crawl. Trailing pr-8 == internal gap-8 so
                the seam spacing matches. */}
            <TickerRow nodes={items} />
            <TickerRow nodes={items} hidden />
          </div>
        )}
        {/* Soft edge fades so items enter/leave without a hard clip. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg-elev to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-elev to-transparent" />
      </div>
    </div>
  );
}
