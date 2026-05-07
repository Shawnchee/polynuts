import { cn } from '@/lib/utils';

export function OddsBar({
  yesProb,
  direction,
}: {
  yesProb: number;
  direction: 'PUMP' | 'DUMP' | 'RANGE';
}) {
  const pct = Math.round(Math.max(0, Math.min(1, yesProb)) * 100);
  const fill =
    direction === 'PUMP' ? 'bg-pump' : direction === 'DUMP' ? 'bg-dump' : 'bg-range';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-240 ease-smooth', fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="num text-xs font-semibold tabular-nums text-text-muted">{pct}%</span>
    </div>
  );
}
