'use client';

import { Info } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { OddsBar } from '@/components/ui/OddsBar';
import { Tooltip } from '@/components/ui/Tooltip';
import { fmtUsd, cn } from '@/lib/utils';
import { useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { getReadClient } from '@/lib/sdk/clients';

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
  const client = getReadClient();
  // SDK helpers — fromUsdcDecimals (6-dec) for available collateral,
  // fromPriceDecimals (8-dec) for premium per contract.
  const volume = Number(client.utils.fromUsdcDecimals(market.availableUsdc));
  const { data: binary, isLoading: binaryLoading } = useMarketBinaryFraming(market);
  const yesProb = binary?.yesProbability ?? null;
  const yesCents = yesProb != null ? Math.round(yesProb * 100) : null;
  const noCents = yesCents != null ? 100 - yesCents : null;
  const multiplier = binary?.multiplier ?? null;
  const isVanilla = market.family === 'vanilla';

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

      {isVanilla ? (
        <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-bg-subtle px-3 py-2">
          <span className="label text-text-dim">Premium</span>
          <span className="num text-base font-bold tabular-nums text-text">
            {fmtUsd(Number(client.utils.fromPriceDecimals(market.pricePerContract)), {
              compact: true,
            })}
          </span>
        </div>
      ) : binary && yesCents != null && noCents != null ? (
        <>
          <div className="mt-4 flex items-center gap-1">
            <Tooltip
              className="z-10"
              content={
                <span>
                  <strong>{yesCents}¢</strong> = the market thinks there&apos;s
                  ~{yesCents}% chance YES happens. Pay {yesCents}¢, win $1 if
                  it does. NO is the inverse.
                </span>
              }
            >
              <span
                role="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-3 w-3 cursor-help items-center justify-center text-text-dim hover:text-text-muted"
                aria-label="What does YES/NO cents mean?"
              >
                <Info className="h-3 w-3" />
              </span>
            </Tooltip>
            <span className="label text-text-dim">odds</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <PillOdds label="YES" cents={yesCents} active="pump" />
            <PillOdds label="NO" cents={noCents} active="dump" />
          </div>
          <div className="mt-3">
            <OddsBar yesProb={yesCents / 100} direction={market.direction} />
          </div>
        </>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <OddsSkeleton loading={binaryLoading} />
          <OddsSkeleton loading={binaryLoading} />
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
              market.direction === 'PUMP' && 'border-pump/30 text-pump dark:text-pump-dark',
              market.direction === 'DUMP' && 'border-dump/30 text-dump dark:text-dump-dark',
              market.direction === 'RANGE' && 'border-range/30 text-range dark:text-range-dark'
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

function OddsSkeleton({ loading }: { loading: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-9 items-center justify-between overflow-hidden rounded-md border border-line bg-bg-subtle px-2.5'
      )}
    >
      {loading && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent" />
      )}
    </div>
  );
}
