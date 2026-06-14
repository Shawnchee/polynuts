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

/**
 * Polymarket-style hero band — big rotating featured card on the left,
 * ranked Hot Markets list on the right. Auto-rotates every 9s and pauses
 * on hover. Carousel arrows + dot indicators give manual control.
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
      // items-start so the hero card only takes the height it needs and
      // doesn't stretch to match the taller Hot Markets list. Without
      // this, the hero ends up with ~150px of dead space below.
      className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_280px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroCard
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
      <HotList
        markets={markets}
        selectedId={selectedId}
        onSelect={onSelect}
        multiplierByMarket={multiplierByMarket}
      />
    </div>
  );
}

function HeroCard({
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
  // Implied probability is rendered as the "X% chance" headline; no NO
  // side, no separate price — just a market signal derived from the
  // SDK-simulated max payout.
  const oddsCents =
    binary?.yesProbability != null &&
    Number.isFinite(binary.yesProbability)
      ? Math.round(binary.yesProbability * 100)
      : null;
  const multiplier = binary?.multiplier ?? null;
  // True while the SDK simulatePayout call is in flight for this market —
  // used to swap blanks for skeleton pulses instead of letting the row
  // visibly empty-then-pop when data arrives.
  const binaryLoading = !binary && market.family !== 'vanilla';
  const volume = Number(client.utils.fromUsdcDecimals(market.availableUsdc));
  const isVanilla = market.family === 'vanilla';
  const dirColor =
    market.direction === 'PUMP'
      ? 'text-pump dark:text-pump-dark'
      : market.direction === 'DUMP'
      ? 'text-dump dark:text-dump-dark'
      : 'text-range dark:text-range-dark';

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl',
        'border border-line bg-bg-elev p-4',
        selected && 'border-text ring-2 ring-text/8'
      )}
    >
      {/* Trending badge top-right */}
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
          <Flame className="h-3 w-3" aria-hidden />
          Featured · #{index + 1}
        </div>
        <TimerBadge expirySec={market.expiry} />
      </div>

      {/* Headline */}
      <button
        onClick={() => onSelect(market.id)}
        className="mt-3 flex items-start gap-3 text-left press-scale"
      >
        <TokenIcon asset={market.asset} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-md font-semibold leading-snug text-text">
            {market.question}
          </h3>
          {!isVanilla && oddsCents != null ? (
            <p className={cn('num mt-0.5 text-sm font-bold tabular-nums', dirColor)}>
              {oddsCents}% chance
            </p>
          ) : binaryLoading ? (
            <div
              aria-label="Calculating implied probability"
              className="mt-1 h-3.5 w-24 animate-pulse rounded bg-surface-hover"
            />
          ) : null}
        </div>
      </button>

      {/* Outcome row — single CTA. The user buys the option (or not);
          there is no NO side on the order book to fill, so we don't
          render one. Bounded structures show the SDK-derived multiplier;
          vanilla shows the strike-based CTA (open-ended payoff). */}
      {!isVanilla && safeMult(multiplier) != null ? (
        <div className="mt-4">
          <HeroOutcome
            label={`Bet ${market.direction} · ${safeMult(multiplier)}x max`}
            direction={market.direction}
            onClick={() => onSelect(market.id)}
          />
        </div>
      ) : (
        <div className="mt-4">
          <HeroOutcome
            label={`Bet ${
              market.direction === 'PUMP' ? 'above' : 'below'
            } ${safeStrike(
              Number(client.utils.fromStrikeDecimals(market.strikesAsc[0] ?? 0n))
            )}`}
            direction={market.direction}
            onClick={() => onSelect(market.id)}
          />
        </div>
      )}

      {/* Meta strip + carousel controls combined into a single bottom row
          to remove the dead vertical space the user flagged. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className="tabular-nums">
            <span className="num font-semibold text-text">
              {safeUsd(volume, { compact: true })}
            </span>{' '}
            vol
          </span>
          {safeMult(multiplier) != null && (
            <span className="tabular-nums">
              <span className="num font-semibold text-text">
                {safeMult(multiplier)}x
              </span>{' '}
              max
            </span>
          )}
          <span className="uppercase tracking-wide text-text-dim">
            {market.structureName}
          </span>
        </div>
        {total > 1 && (
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
        )}
      </div>
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
        'press-scale flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-base font-semibold transition-colors duration-180',
        cls
      )}
    >
      <span>{label}</span>
    </button>
  );
}

function HotList({
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
  const client = getReadClient();
  const top = useMemo(() => markets.slice(0, 6), [markets]);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-elev">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="label text-text-muted">Hot Markets</span>
        <Flame className="h-3 w-3 text-gold" aria-hidden />
      </div>
      <ul className="divide-y divide-line">
        {top.map((m, i) => {
          const vol = Number(client.utils.fromUsdcDecimals(m.availableUsdc));
          const mult = multiplierByMarket.get(m.id);
          const isSelected = selectedId === m.id;
          return (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className={cn(
                  'press-scale flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-120',
                  isSelected
                    ? 'bg-surface'
                    : 'hover:bg-surface-hover'
                )}
              >
                <span className="num w-4 shrink-0 text-xs font-bold tabular-nums text-text-dim">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-1 text-xs font-medium text-text">
                    {m.question}
                  </span>
                  <span className="num text-[10px] tabular-nums text-text-dim">
                    {safeUsd(vol, { compact: true })}
                    {safeMult(mult, 1) != null && (
                      <span className="ml-1.5">· {safeMult(mult, 1)}x</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
