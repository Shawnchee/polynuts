'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { fmtUsd, cn } from '@/lib/utils';
import { useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';

const ROTATE_MS = 9_000;

// Safe formatting — guards NaN/Infinity from SDK decimal parsing so a
// brand-new market never renders "$NaN"/"NaNx". fmtUsd itself lives in
// lib/utils (not owned here); see report note.
function safeUsd(n: number, opts?: { compact?: boolean }): string {
  return Number.isFinite(n) ? fmtUsd(n, opts) : '$0.00';
}

function safeMult(n: number | null | undefined, digits = 2): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : null;
}

function safeStrike(n: number): string {
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '—';
}

function dirText(direction: MarketView['direction']): string {
  return direction === 'PUMP'
    ? 'text-pump dark:text-pump-dark'
    : direction === 'DUMP'
    ? 'text-dump dark:text-dump-dark'
    : 'text-range dark:text-range-dark';
}

/**
 * Hero band — ONE big featured banner with the primary bet CTA, and a
 * horizontally-scrollable "hot markets" pill rail beneath it. The rail is a
 * cursor-stable click target (the moving Bloomberg-style tape lives in
 * MarketTicker, where nothing is clickable). Auto-rotates the banner every 9s,
 * pauses on hover; arrows + dots give manual control.
 *
 * Featured ranking comes pre-computed from the parent (volume × payout
 * multiplier — see page.tsx). All input values flow from SDK paths
 * (client.utils.fromUsdcDecimals + client.option.simulatePayout).
 */
export function FeaturedHero({
  markets,
  selectedId,
  onSelect,
  multiplierByMarket,
}: {
  markets: MarketView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  multiplierByMarket: Map<string, number>;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Reset index when the markets array shrinks past the current
  // index (e.g. timeframe filter changed and there are fewer featured).
  useEffect(() => {
    if (index >= markets.length) setIndex(0);
  }, [markets.length, index]);

  // Auto-rotate the hero card.
  useEffect(() => {
    if (paused || markets.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % markets.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, markets.length]);

  if (markets.length === 0) return null;
  const hero = markets[Math.min(index, markets.length - 1)];

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroBanner
        market={hero}
        selected={selectedId === hero.id}
        onSelect={onSelect}
        index={index}
        total={markets.length}
        onPrev={() =>
          setIndex((i) => (i - 1 + markets.length) % markets.length)
        }
        onNext={() => setIndex((i) => (i + 1) % markets.length)}
        onJump={setIndex}
      />
      <HotRail
        markets={markets}
        selectedId={selectedId}
        onSelect={onSelect}
        multiplierByMarket={multiplierByMarket}
      />
    </div>
  );
}

function HeroBanner({
  market,
  selected,
  onSelect,
  index,
  total,
  onPrev,
  onNext,
  onJump,
}: {
  market: MarketView;
  selected: boolean;
  onSelect: (id: string) => void;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
}) {
  const client = getReadClient();
  const { data: binary } = useMarketBinaryFraming(market);
  const oddsCents =
    binary?.yesProbability != null && Number.isFinite(binary.yesProbability)
      ? Math.round(binary.yesProbability * 100)
      : null;
  const multiplier = binary?.multiplier ?? null;
  const binaryLoading = !binary && market.family !== 'vanilla';
  const volume = Number(client.utils.fromUsdcDecimals(market.availableUsdc));
  const isVanilla = market.family === 'vanilla';
  const dirColor = dirText(market.direction);

  const tint =
    market.direction === 'PUMP'
      ? 'from-pump/[0.06]'
      : market.direction === 'DUMP'
      ? 'from-dump/[0.06]'
      : 'from-range/[0.06]';

  const ctaLabel =
    !isVanilla && safeMult(multiplier) != null
      ? `Bet ${market.direction} · up to ${safeMult(multiplier)}x`
      : `Bet ${
          market.direction === 'PUMP' ? 'above' : 'below'
        } ${safeStrike(
          Number(client.utils.fromStrikeDecimals(market.strikesAsc[0] ?? 0n))
        )}`;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-bg-elev',
        'bg-gradient-to-br to-transparent p-5 sm:p-6',
        tint,
        selected && 'border-text ring-2 ring-text/8'
      )}
    >
      {/* Top row — featured marker + structure name. The deadline lives in the
          decision strip below (grouped with payout), so it isn't duplicated
          here. */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
          <Flame className="h-3 w-3" aria-hidden />
          Featured
        </span>
        <span className="uppercase tracking-wide text-xs text-text-dim">
          {market.structureName}
        </span>
      </div>

      {/* Headline */}
      <button
        onClick={() => onSelect(market.id)}
        className="press-scale mt-4 flex w-full items-start gap-3 text-left sm:gap-4"
      >
        <TokenIcon asset={market.asset} size={48} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-text sm:text-xl">
            {market.question}
          </h2>
          {!isVanilla && oddsCents != null ? (
            <p className={cn('num mt-1 text-sm font-bold tabular-nums', dirColor)}>
              {oddsCents}% chance
            </p>
          ) : binaryLoading ? (
            <div className="mt-1.5 h-4 w-24 animate-pulse rounded bg-surface-hover" />
          ) : null}
        </div>
      </button>

      {/* Decision pair — max payout beside the deadline, the two facts the
          bet turns on, promoted to their own bordered strip. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-bg/40 px-4 py-3">
        <PairStat label="Max payout">
          {!isVanilla && safeMult(multiplier) != null ? (
            <span className={cn('num text-lg font-bold tabular-nums', dirColor)}>
              {safeMult(multiplier)}x
            </span>
          ) : binaryLoading ? (
            <span className="inline-block h-5 w-14 animate-pulse rounded bg-surface-hover" />
          ) : (
            <span className="num text-lg font-bold text-text">—</span>
          )}
        </PairStat>
        <span className="h-8 w-px bg-line" aria-hidden />
        <PairStat label="Closes">
          <TimerBadge expirySec={market.expiry} emphasis />
        </PairStat>
        <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
        <PairStat label="Liquidity">
          <span className="num text-sm font-semibold tabular-nums text-text">
            {safeUsd(volume, { compact: true })}
          </span>
        </PairStat>
      </div>

      {/* Primary CTA */}
      <div className="mt-4">
        <HeroOutcome
          label={ctaLabel}
          direction={market.direction}
          onClick={() => onSelect(market.id)}
        />
      </div>

      {/* Carousel controls */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onPrev}
              aria-label="Previous featured market"
              className="press-scale inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onJump(i)}
                  aria-label={`Jump to featured market ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-240',
                    i === index ? 'w-5 bg-text' : 'w-1.5 bg-line hover:bg-text-dim'
                  )}
                />
              ))}
            </div>
            <button
              onClick={onNext}
              aria-label="Next featured market"
              className="press-scale inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PairStat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-text-dim">
        {label}
      </span>
      {children}
    </div>
  );
}

function HeroOutcome({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: MarketView['direction'];
  onClick: () => void;
}) {
  const cls =
    direction === 'PUMP'
      ? 'bg-pump/15 border-pump/40 text-pump dark:bg-pump/20 dark:text-pump-dark hover:bg-pump/25 dark:hover:bg-pump/30'
      : direction === 'DUMP'
      ? 'bg-dump/15 border-dump/40 text-dump dark:bg-dump/20 dark:text-dump-dark hover:bg-dump/25 dark:hover:bg-dump/30'
      : 'bg-range/15 border-range/40 text-range dark:bg-range/20 dark:text-range-dark hover:bg-range/25 dark:hover:bg-range/30';
  return (
    <button
      onClick={onClick}
      className={cn(
        'press-scale flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-base font-semibold transition-colors duration-180',
        cls
      )}
    >
      <span>{label}</span>
    </button>
  );
}

function HotRail({
  markets,
  selectedId,
  onSelect,
  multiplierByMarket,
}: {
  markets: MarketView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  multiplierByMarket: Map<string, number>;
}) {
  const top = useMemo(() => markets.slice(0, 10), [markets]);
  if (top.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <Flame className="h-3 w-3 text-gold" aria-hidden />
        <span className="label text-text-muted">Hot markets</span>
      </div>
      {/* Horizontal, user-scrollable rail — cursor-stable click targets. */}
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {top.map((m, i) => {
          const mult = multiplierByMarket.get(m.id);
          const isSelected = selectedId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                'press-scale flex w-56 shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors duration-120',
                isSelected
                  ? 'border-text bg-surface'
                  : 'border-line bg-bg-elev hover:border-text-dim hover:bg-surface-hover'
              )}
            >
              <span className="num w-4 shrink-0 text-xs font-bold tabular-nums text-text-dim">
                {i + 1}
              </span>
              <TokenIcon asset={m.asset} size={20} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-1 text-xs font-medium text-text">
                  {m.question}
                </span>
                <span className="num text-[10px] tabular-nums text-text-dim">
                  {safeMult(mult, 1) != null ? (
                    <>
                      up to{' '}
                      <span className={cn('font-semibold', dirText(m.direction))}>
                        {safeMult(mult, 1)}x
                      </span>
                    </>
                  ) : (
                    m.structureName
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
