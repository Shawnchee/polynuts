'use client';

import type { MarketView } from '@/lib/sdk/markets';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { fmtUsd, cn } from '@/lib/utils';
import { useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';

const directionGlow: Record<MarketView['direction'], string> = {
  PUMP: 'glow-pump',
  DUMP: 'glow-dump',
  RANGE: 'glow-range',
};

// Safe money — guards NaN/Infinity from SDK decimal parsing so a brand-new
// market with an empty/odd availableUsdc never renders "$NaN". fmtUsd itself
// lives in lib/utils (not owned here); see report note.
function safeUsd(n: number, opts?: { compact?: boolean }): string {
  return Number.isFinite(n) ? fmtUsd(n, opts) : '$0.00';
}

// Safe multiplier — guards NaN/Infinity so we never render "NaNx"/"Infinityx".
function safeMult(n: number | null | undefined, digits = 2): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : null;
}

// Safe strike — used for the vanilla "above/below $X" CTA. Falls back to '—'
// rather than "$NaN" when the strike is missing/unparseable.
function safeStrike(n: number): string {
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '—';
}

/**
 * Compact market card.
 *
 *   ┌──────────────────────────────┐
 *   │ ◆ Will ETH close above        │  ← asset glyph + question (2 lines max)
 *   │   $1,700 by 12PM UTC?    80%  │  ← implied chance, top-right
 *   │ ┌──────────────────────────┐  │
 *   │ │        Bet PUMP          │  │  ← single CTA (direction only)
 *   │ └──────────────────────────┘  │
 *   │ up to 1.25x · Tom 08:00  $1K  │  ← decision pair (payout+expiry) | liq
 *   └──────────────────────────────┘
 *
 * The two facts a bettor decides on — max payout and expiry — are grouped
 * into one prominent line; liquidity is demoted to the far right. Expiry is
 * emphasis-colored (< 1h red, < 6h amber) so the deadline reads at a glance.
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
  // Implied probability for the % chance corner indicator only — derived
  // from the SDK-simulated max payout (1 / multiplier). No NO side; the
  // user buys the option or doesn't. The probability is a market signal,
  // not a tradable side.
  const oddsCents =
    binary?.yesProbability != null &&
    Number.isFinite(binary.yesProbability)
      ? Math.round(binary.yesProbability * 100)
      : null;
  const multiplier = binary?.multiplier ?? null;
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
          <TokenIcon asset={market.asset} size={24} className="mt-0.5" />
          <p className="line-clamp-2 min-h-[34px] text-sm font-medium leading-snug text-text">
            {market.question}
          </p>
        </div>
        {!isVanilla && oddsCents != null ? (
          <div className="flex shrink-0 flex-col items-end">
            <span className={cn('num text-md font-bold tabular-nums', dirColor)}>
              {oddsCents}%
            </span>
            <span className="text-[9px] uppercase tracking-wide text-text-dim">
              chance
            </span>
          </div>
        ) : (
          <span className="num text-xs tabular-nums text-text-dim">
            {safeUsd(
              Number(client.utils.fromPriceDecimals(market.pricePerContract)),
              { compact: true }
            )}
          </span>
        )}
      </div>

      {/* Outcome row — single CTA per market. The user buys the option (or
          doesn't); there is no NO side to fill. The CTA carries direction
          only now — the max payout moved down to the decision pair so it
          reads next to the deadline. The CTA renders immediately (direction
          is known synchronously); only the "up to Nx" waits on the SDK
          payout sim. Vanilla shows the strike-based CTA (open-ended payoff,
          no max multiplier). */}
      <div className="mt-3">
        <OutcomeButton
          label={
            isVanilla
              ? `Bet ${
                  market.direction === 'PUMP' ? 'above' : 'below'
                } ${safeStrike(
                  Number(
                    client.utils.fromStrikeDecimals(market.strikesAsc[0] ?? 0n)
                  )
                )}`
              : `Bet ${market.direction}`
          }
          direction={market.direction}
        />
      </div>

      {/* Decision pair — the two facts a bettor decides on, grouped: max
          payout (reward) sitting right beside expiry (deadline). Liquidity
          is demoted to the far right. Expiry is emphasis-colored so "how
          long do I have" reads at a glance. */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          {!isVanilla &&
            (safeMult(multiplier) != null ? (
              <span className="num inline-flex items-center gap-1 tabular-nums">
                <span className="text-text-dim">up to</span>
                <span className={cn('font-bold', dirColor)}>
                  {safeMult(multiplier)}x
                </span>
              </span>
            ) : (
              <span
                aria-label="Calculating max payout"
                className={cn(
                  'inline-block h-3 w-12 rounded bg-bg-subtle',
                  binaryLoading && 'animate-pulse'
                )}
              />
            ))}
          {!isVanilla && <span className="text-line">·</span>}
          <TimerBadge expirySec={market.expiry} emphasis />
        </div>
        <span className="num shrink-0 text-[11px] tabular-nums text-text-dim">
          <span className="font-medium text-text-muted">
            {safeUsd(volume, { compact: true })}
          </span>{' '}
          liq
        </span>
      </div>
    </button>
  );
}

function OutcomeButton({
  label,
  direction,
}: {
  label: string;
  direction: MarketView['direction'];
}) {
  const cls =
    direction === 'PUMP'
      ? 'bg-pump/15 border-pump/40 text-pump dark:bg-pump/20 dark:text-pump-dark hover:bg-pump/25 dark:hover:bg-pump/30'
      : direction === 'DUMP'
      ? 'bg-dump/15 border-dump/40 text-dump dark:bg-dump/20 dark:text-dump-dark hover:bg-dump/25 dark:hover:bg-dump/30'
      : 'bg-range/15 border-range/40 text-range dark:bg-range/20 dark:text-range-dark hover:bg-range/25 dark:hover:bg-range/30';
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors duration-180',
        cls
      )}
    >
      <span>{label}</span>
    </div>
  );
}

