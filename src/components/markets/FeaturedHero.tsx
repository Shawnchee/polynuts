'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { fmtUsd, cn } from '@/lib/utils';
import { useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';

const ASSET_GLYPH: Record<string, string> = {
  ETH: '◆',
  BTC: '₿',
  SOL: '◎',
  XRP: '✕',
  DOGE: 'Ð',
  BNB: 'B',
  AVAX: 'A',
};

const ROTATE_MS = 9_000;

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
      className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]"
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
  const yesProb = binary?.yesProbability ?? null;
  const yesCents = yesProb != null ? Math.round(yesProb * 100) : null;
  const noCents = yesCents != null ? 100 - yesCents : null;
  const multiplier = binary?.multiplier ?? null;
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
        'border border-line bg-bg-elev p-5',
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
        <span
          aria-hidden
          className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-xl font-bold text-text"
        >
          {ASSET_GLYPH[market.asset] ?? market.asset.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-text">
            {market.question}
          </h3>
          {!isVanilla && yesCents != null && (
            <p className={cn('num mt-1 text-base font-bold', dirColor)}>
              {yesCents}% chance
            </p>
          )}
        </div>
      </button>

      {/* Outcome row — same logic as MarketCard:
          binary structures get YES / NO; vanilla gets one directional CTA. */}
      {!isVanilla && yesCents != null && noCents != null ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <HeroOutcome
            label="Yes"
            cents={yesCents}
            variant="yes"
            onClick={() => onSelect(market.id)}
          />
          <HeroOutcome
            label="No"
            cents={noCents}
            variant="no"
            onClick={() => onSelect(market.id)}
          />
        </div>
      ) : (
        <div className="mt-4">
          <HeroOutcome
            label={
              market.direction === 'PUMP'
                ? `Bet above $${(Number(market.strikesAsc[0] ?? 0n) / 1e8).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : `Bet below $${(Number(market.strikesAsc[0] ?? 0n) / 1e8).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            }
            cents={null}
            variant={market.direction === 'PUMP' ? 'yes' : 'no'}
            onClick={() => onSelect(market.id)}
          />
        </div>
      )}

      {/* Meta strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>
          <span className="num font-semibold text-text">
            {fmtUsd(volume, { compact: true })}
          </span>{' '}
          volume
        </span>
        {multiplier != null && (
          <span>
            <span className="num font-semibold text-text">
              {multiplier.toFixed(2)}x
            </span>{' '}
            max return
          </span>
        )}
        <span className="ml-auto uppercase tracking-wide">
          {market.structureName}
        </span>
      </div>

      {/* Carousel controls */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={onPrev}
            aria-label="Previous featured market"
            className="press-scale inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg-elev text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => onJump(i)}
                aria-label={`Jump to featured market ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-240',
                  i === index ? 'w-6 bg-text' : 'w-1.5 bg-line hover:bg-text-dim'
                )}
              />
            ))}
          </div>
          <button
            onClick={onNext}
            aria-label="Next featured market"
            className="press-scale inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg-elev text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function HeroOutcome({
  label,
  cents,
  variant,
  onClick,
}: {
  label: string;
  cents: number | null;
  variant: 'yes' | 'no' | 'muted';
  onClick: () => void;
}) {
  const cls =
    variant === 'yes'
      ? 'bg-pump/12 text-pump dark:bg-pump/15 dark:text-pump-dark hover:bg-pump/20 dark:hover:bg-pump/25'
      : variant === 'no'
      ? 'bg-dump/12 text-dump dark:bg-dump/15 dark:text-dump-dark hover:bg-dump/20 dark:hover:bg-dump/25'
      : 'bg-bg-subtle text-text-muted';
  return (
    <button
      onClick={onClick}
      className={cn(
        'press-scale flex items-center justify-between gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-180',
        cls
      )}
    >
      <span>{label}</span>
      {cents != null && (
        <span className="num text-base tabular-nums">{cents}¢</span>
      )}
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
                  <span className="num text-[10px] text-text-dim">
                    {fmtUsd(vol, { compact: true })}
                    {mult != null && (
                      <span className="ml-1.5">· {mult.toFixed(1)}x</span>
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
