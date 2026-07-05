'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ACCENT, FadeIn, GhostWord } from '@/components/landing/reel';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { useMarkets } from '@/lib/sdk/useOrders';
import { useMarketBinaryFramings } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';
import { fmtUsd } from '@/lib/utils';
import type { MarketView } from '@/lib/sdk/markets';

const TOP_N = 6;
const DIR_ORDER: Record<MarketView['direction'], number> = { PUMP: 0, DUMP: 1, RANGE: 2 };

const DIR_COLOR: Record<MarketView['direction'], string> = {
  PUMP: 'text-green-400',
  DUMP: 'text-rose-400',
  RANGE: 'text-violet-400',
};

// Market | Bet | Volume | Expiry. Volume is hidden on mobile so the visible
// cell count always matches the grid track count at each breakpoint.
const COLS = 'grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_0.9fr_0.8fr_auto]';

function HeaderRow() {
  return (
    <div
      className={`grid ${COLS} items-center gap-3 border-b border-white/[0.06] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35`}
    >
      <span>Market</span>
      <span className="text-right">Bet</span>
      <span className="hidden text-right sm:block">Liquidity</span>
      <span className="w-16 text-right">Expiry</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`grid ${COLS} items-center gap-3 border-b border-white/[0.04] px-5 py-4`}>
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-3.5 w-44 animate-pulse rounded bg-white/[0.06]" />
          </div>
          <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-white/[0.06]" />
          <div className="ml-auto hidden h-3.5 w-12 animate-pulse rounded bg-white/[0.06] sm:block" />
          <div className="ml-auto h-3.5 w-12 animate-pulse rounded bg-white/[0.06]" />
        </div>
      ))}
    </>
  );
}

export function LiveMarkets() {
  const { markets, isLoading } = useMarkets();
  const client = getReadClient();

  // Polynuts positions as a BTC/ETH product, so the landing only showcases
  // those — the underlying Thetanuts book also lists AVAX/BNB/etc, but we
  // don't surface them here. Then show one market per (asset, direction) so
  // the table reads as a varied cross-section (PUMP / DUMP / RANGE on BTC and
  // ETH), highest volume winning within each bucket.
  const best = new Map<string, MarketView>();
  for (const m of markets) {
    if (m.asset !== 'BTC' && m.asset !== 'ETH') continue;
    const key = `${m.asset}-${m.direction}`;
    const cur = best.get(key);
    if (!cur || m.availableUsdc > cur.availableUsdc) best.set(key, m);
  }
  const top = [...best.values()]
    .sort((a, b) =>
      a.asset === b.asset
        ? DIR_ORDER[a.direction] - DIR_ORDER[b.direction]
        : a.asset < b.asset
        ? -1
        : 1
    )
    .slice(0, TOP_N);
  const framings = useMarketBinaryFramings(top);

  const showSkeleton = isLoading && top.length === 0;
  const empty = !isLoading && top.length === 0;

  // Bounded structures (spreads/condors/rangers) have a real max multiplier —
  // show "3.2x max". Vanilla calls/puts are open-ended, so we show the strike
  // threshold instead, mirroring the OutcomeButton on the real market card.
  function betLabel(m: MarketView, mult: number | null | undefined): string {
    if (typeof mult === 'number' && Number.isFinite(mult) && mult > 1) {
      return `${mult.toFixed(2)}x max`;
    }
    const strike = Number(client.utils.fromStrikeDecimals(m.strikesAsc[0] ?? 0n));
    if (!Number.isFinite(strike)) return '—';
    const s = `$${strike.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return m.direction === 'PUMP' ? `> ${s}` : m.direction === 'DUMP' ? `< ${s}` : s;
  }

  return (
    <section aria-label="Live order book" className="relative overflow-hidden">
      <GhostWord range={-110} className="right-[-2vw] top-16 text-[17vw]">
        02
      </GhostWord>
      <div className="relative mx-auto w-full max-w-page px-6 py-28 sm:px-10 md:py-40 lg:px-16">
        <div className="mb-12 flex items-end justify-between gap-4">
          <FadeIn>
            <p
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: ACCENT }}
            >
              02 — Live order book
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Trade these{' '}
              <span className="font-serif italic font-normal tracking-[-0.01em]" style={{ color: ACCENT }}>
                right now
              </span>
            </h2>
          </FadeIn>
          <Link
            href="/markets"
            className="group hidden shrink-0 items-center gap-1.5 font-mono text-xs text-white/55 transition-colors hover:text-white sm:flex"
          >
            View all markets
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <HeaderRow />

          {showSkeleton && <SkeletonRows />}

          {empty && (
            <div className="px-5 py-14 text-center font-mono text-sm text-white/40">
              No live markets at the moment — check back shortly.
            </div>
          )}

          {top.map((m, i) => {
            const f = framings[i]?.data;
            const volume = Number(client.utils.fromUsdcDecimals(m.availableUsdc));
            return (
              <Link
                key={m.id}
                // Deep-link to the specific market so clicking a row opens
                // that trade in the panel, not the generic markets page.
                // MarketsPage reads ?m=<id> on load and pre-selects it.
                href={`/markets?m=${encodeURIComponent(m.id)}`}
                className={`grid ${COLS} items-center gap-3 border-b border-white/[0.04] px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03]`}
              >
                {/* Market */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <TokenIcon asset={m.asset} size={26} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white">{m.asset}</span>
                      <span className={`font-mono text-[10px] font-bold ${DIR_COLOR[m.direction]}`}>
                        {m.direction}
                      </span>
                    </div>
                    <p className="truncate text-xs text-white/45">{m.question}</p>
                  </div>
                </div>
                {/* Bet — multiplier (bounded) or strike threshold (vanilla) */}
                <span className={`text-right font-mono text-sm font-semibold tabular-nums ${DIR_COLOR[m.direction]}`}>
                  {betLabel(m, f?.multiplier)}
                </span>
                {/* Volume */}
                <span className="hidden text-right font-mono text-sm tabular-nums text-white/55 sm:block">
                  {Number.isFinite(volume) ? fmtUsd(volume, { compact: true }) : '$0'}
                </span>
                {/* Expiry */}
                <span className="flex w-16 justify-end">
                  <TimerBadge expirySec={m.expiry} />
                </span>
              </Link>
            );
          })}
        </div>
        </FadeIn>

        <Link
          href="/markets"
          className="mt-5 flex items-center justify-center gap-1.5 font-mono text-xs text-white/55 transition-colors hover:text-white sm:hidden"
        >
          View all markets
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
