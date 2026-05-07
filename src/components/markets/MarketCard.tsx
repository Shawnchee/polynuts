'use client';

import type { MarketView } from '@/lib/sdk/markets';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { OddsBar } from '@/components/ui/OddsBar';
import { fmtUsd } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function MarketCard({
  market,
  selected,
  onSelect,
}: {
  market: MarketView;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  const yesCents = Math.round(market.yesProbability * 100);
  const noCents = 100 - yesCents;
  const volume = Number(market.availableUsdc) / 1e6;

  return (
    <button
      onClick={() => onSelect(market.id)}
      className={cn(
        'group flex h-full flex-col rounded-lg border bg-white p-4 text-left transition-all duration-120',
        'hover:border-ink-400',
        selected ? 'border-1.5 border-ink-900' : 'border-ink-200'
      )}
    >
      <div className="flex items-center justify-between">
        <DirectionTag direction={market.direction} />
        <TimerBadge expirySec={market.expiry} />
      </div>

      <p className="mt-3 line-clamp-2 min-h-[36px] text-base font-medium leading-snug text-ink-900">
        {market.question}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PillOdds label="YES" cents={yesCents} active="pump" />
        <PillOdds label="NO" cents={noCents} active="dump" />
      </div>

      <div className="mt-3">
        <OddsBar yesProb={market.yesProbability} direction={market.direction} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
        <span>
          <span className="label text-ink-400">vol</span>{' '}
          <span className="num text-ink-900">{fmtUsd(volume, { compact: true })}</span>
        </span>
        <span className="num text-ink-600">{market.multiplier.toFixed(2)}x</span>
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
      ? 'border-pump-border bg-pump-light text-pump'
      : 'border-dump-border bg-dump-light text-dump';
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-2.5 py-1.5',
        colorCls
      )}
    >
      <span className="label">{label}</span>
      <span className="num text-base font-bold tabular-nums">{cents}¢</span>
    </div>
  );
}
