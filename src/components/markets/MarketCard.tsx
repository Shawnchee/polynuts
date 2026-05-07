'use client';

import type { MarketView } from '@/lib/sdk/markets';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { OddsBar } from '@/components/ui/OddsBar';
import { fmtUsd, cn } from '@/lib/utils';

const directionGlow: Record<MarketView['direction'], string> = {
  PUMP: 'glow-pump',
  DUMP: 'glow-dump',
  RANGE: 'glow-range',
};

export function MarketCard({
  market,
  selected,
  onSelect,
}: {
  market: MarketView;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  const volume = Number(market.availableUsdc) / 1e6;
  const yesProb = market.binary?.yesProbability ?? null;
  const yesCents = yesProb != null ? Math.round(yesProb * 100) : null;
  const noCents = yesCents != null ? 100 - yesCents : null;
  const multiplier = market.binary?.multiplier ?? null;

  return (
    <button
      onClick={() => onSelect(market.id)}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl',
        'border border-line bg-bg-elev p-4 text-left',
        'card-lift press-scale cursor-pointer',
        'hover:border-text-dim',
        selected && 'border-text ring-2 ring-text/8 ' + directionGlow[market.direction]
      )}
    >
      {/* Selection accent line */}
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

      <div className="flex items-center justify-between">
        <DirectionTag direction={market.direction} />
        <TimerBadge expirySec={market.expiry} />
      </div>

      <p className="mt-3 line-clamp-2 min-h-[36px] text-base font-medium leading-snug text-text">
        {market.question}
      </p>

      {yesCents != null && noCents != null ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <PillOdds label="YES" cents={yesCents} active="pump" />
            <PillOdds label="NO" cents={noCents} active="dump" />
          </div>
          <div className="mt-3">
            <OddsBar yesProb={yesCents / 100} direction={market.direction} />
          </div>
        </>
      ) : (
        // Vanilla — no binary framing; show structure + premium instead
        <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-bg-subtle px-3 py-2">
          <span className="label text-text-dim">Premium</span>
          <span className="num text-base font-bold tabular-nums text-text">
            {fmtUsd(Number(market.pricePerContract) / 1e8, { compact: true })}
          </span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-4 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="label text-text-dim">vol</span>
          <span className="num font-semibold text-text">
            {fmtUsd(volume, { compact: true })}
          </span>
        </span>
        {multiplier != null && multiplier > 0 ? (
          <span
            className={cn(
              'num rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums',
              market.direction === 'PUMP' && 'border-pump/30 text-pump',
              market.direction === 'DUMP' && 'border-dump/30 text-dump',
              market.direction === 'RANGE' && 'border-range/30 text-range'
            )}
          >
            {multiplier.toFixed(2)}x
          </span>
        ) : (
          <span className="text-xs uppercase tracking-wide text-text-dim">
            {market.structureName}
          </span>
        )}
      </div>
    </button>
  );
}

function PillOdds({
  label,
  cents,
  active,
}: {
  label: string;
  cents: number;
  active: 'pump' | 'dump';
}) {
  const colorCls =
    active === 'pump'
      ? 'border-pump-border/60 bg-pump-light dark:bg-pump/10 text-pump dark:text-pump-dark'
      : 'border-dump-border/60 bg-dump-light dark:bg-dump/10 text-dump dark:text-dump-dark';
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-2.5 py-1.5 transition-colors duration-180',
        colorCls
      )}
    >
      <span className="label">{label}</span>
      <span className="num text-base font-bold tabular-nums">{cents}¢</span>
    </div>
  );
}
