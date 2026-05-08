'use client';

import type { MarketView } from '@/lib/sdk/markets';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { fmtUsd, cn } from '@/lib/utils';
import { useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';

const directionGlow: Record<MarketView['direction'], string> = {
  PUMP: 'glow-pump',
  DUMP: 'glow-dump',
  RANGE: 'glow-range',
};

const assetEmoji: Record<string, string> = {
  ETH: '◆',
  BTC: '₿',
  SOL: '◎',
  XRP: '✕',
  DOGE: 'Ð',
  BNB: 'B',
  AVAX: 'A',
};

/**
 * Compact Polymarket-style market card.
 *
 *   ┌──────────────────────────┐
 *   │ ◆ Will ETH close above    │  ← asset glyph + question (2 lines max)
 *   │   $3,200 by 4PM UTC?      │
 *   │                  62¢ ↑    │  ← lead probability + direction arrow
 *   │ ┌────────┐ ┌────────┐    │
 *   │ │ Yes 62¢│ │ No  38¢│    │  ← compact YES/NO row
 *   │ └────────┘ └────────┘    │
 *   │ $84K vol      Tom 08:00   │  ← meta strip at bottom
 *   └──────────────────────────┘
 *
 * Tighter padding (12px instead of 16px), smaller meta row, big YES/NO
 * buttons that visually dominate to match Polymarket's compact 4-col grid.
 */
export function MarketCard({
  market,
  selected,
  onSelect,
}: {
  market: MarketView;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  const client = getReadClient();
  const volume = Number(client.utils.fromUsdcDecimals(market.availableUsdc));
  const { data: binary, isLoading: binaryLoading } = useMarketBinaryFraming(market);
  const yesProb = binary?.yesProbability ?? null;
  const yesCents = yesProb != null ? Math.round(yesProb * 100) : null;
  const noCents = yesCents != null ? 100 - yesCents : null;
  const isVanilla = market.family === 'vanilla';

  const dirColor =
    market.direction === 'PUMP'
      ? 'text-pump dark:text-pump-dark'
      : market.direction === 'DUMP'
      ? 'text-dump dark:text-dump-dark'
      : 'text-range dark:text-range-dark';

  return (
    <button
      onClick={() => onSelect(market.id)}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl',
        'border border-line bg-bg-elev p-3 text-left',
        'card-lift press-scale cursor-pointer',
        'hover:border-text-dim',
        selected && 'border-text ring-2 ring-text/8 ' + directionGlow[market.direction]
      )}
    >
      {selected && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-0 h-[2px] origin-left animate-fade-in',
            market.direction === 'PUMP' && 'bg-pump',
            market.direction === 'DUMP' && 'bg-dump',
            market.direction === 'RANGE' && 'bg-range'
          )}
        />
      )}

      {/* Header — asset glyph + question; lead probability on the right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            aria-hidden
            className={cn(
              'num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-bold',
              'bg-bg-subtle text-text'
            )}
          >
            {assetEmoji[market.asset] ?? market.asset.slice(0, 1)}
          </span>
          <p className="line-clamp-2 min-h-[34px] text-sm font-medium leading-snug text-text">
            {market.question}
          </p>
        </div>
        {!isVanilla && yesCents != null ? (
          <div className="flex shrink-0 flex-col items-end">
            <span className={cn('num text-md font-bold tabular-nums', dirColor)}>
              {yesCents}%
            </span>
            <span className="text-[9px] uppercase tracking-wide text-text-dim">
              chance
            </span>
          </div>
        ) : (
          <span className="num text-xs text-text-dim">
            {fmtUsd(
              Number(client.utils.fromPriceDecimals(market.pricePerContract)),
              { compact: true }
            )}
          </span>
        )}
      </div>

      {/* Outcome row.
          - Bounded structures (spread / butterfly / condor / ranger):
            YES / NO binary pricing in cents (Polymarket-style).
          - Vanilla calls/puts: ONE full-width directional CTA — vanilla
            has unbounded payoff so there's no honest "NO" pricing.
          - Loading: shimmer placeholders.
       */}
      {!isVanilla && yesCents != null && noCents != null ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <YesNoButton label="Yes" cents={yesCents} variant="yes" />
          <YesNoButton label="No" cents={noCents} variant="no" />
        </div>
      ) : isVanilla ? (
        <div className="mt-3">
          <YesNoButton
            label={`Bet ${
              market.direction === 'PUMP' ? 'above' : 'below'
            } $${Number(
              client.utils.fromStrikeDecimals(market.strikesAsc[0] ?? 0n)
            ).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            cents={null}
            variant={market.direction === 'PUMP' ? 'yes' : 'no'}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <OddsSkeleton loading={binaryLoading} />
          <OddsSkeleton loading={binaryLoading} />
        </div>
      )}

      {/* Meta strip — volume + expiry */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-text-muted">
        <span className="num">
          <span className="num font-semibold text-text">
            {fmtUsd(volume, { compact: true })}
          </span>{' '}
          vol
        </span>
        <TimerBadge expirySec={market.expiry} />
      </div>
    </button>
  );
}

function YesNoButton({
  label,
  cents,
  variant,
}: {
  label: string;
  cents: number | null;
  variant: 'yes' | 'no' | 'muted';
}) {
  // Matches the FeaturedHero HeroOutcome styling so the visual language
  // of "this is a directional bet" is consistent everywhere — solid tinted
  // bg, hue-matched border, darker fill on hover.
  const cls =
    variant === 'yes'
      ? 'bg-pump/15 border-pump/40 text-pump dark:bg-pump/20 dark:text-pump-dark hover:bg-pump/25 dark:hover:bg-pump/30'
      : variant === 'no'
      ? 'bg-dump/15 border-dump/40 text-dump dark:bg-dump/20 dark:text-dump-dark hover:bg-dump/25 dark:hover:bg-dump/30'
      : 'bg-bg-subtle border-line text-text-muted';
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors duration-180',
        cls
      )}
    >
      <span>{label}</span>
      {cents != null && (
        <span className="num tabular-nums">{cents}¢</span>
      )}
    </div>
  );
}

function OddsSkeleton({ loading }: { loading: boolean }) {
  return (
    <div className="relative flex h-7 items-center justify-between overflow-hidden rounded-md bg-bg-subtle px-2.5">
      {loading && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent" />
      )}
    </div>
  );
}
