import { cn } from '@/lib/utils';
import type { Direction } from '@/lib/sdk/markets';

const map: Record<Direction, { label: string; symbol: string; cls: string }> = {
  PUMP: { label: 'PUMP', symbol: '↑', cls: 'bg-pump-light text-pump border-pump-border' },
  DUMP: { label: 'DUMP', symbol: '↓', cls: 'bg-dump-light text-dump border-dump-border' },
  RANGE: { label: 'RANGE', symbol: '↔', cls: 'bg-range-light text-range border-range-border' },
};

export function DirectionTag({
  direction,
  size = 'sm',
}: {
  direction: Direction;
  size?: 'sm' | 'md';
}) {
  const c = map[direction];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border font-bold uppercase',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        c.cls
      )}
    >
      {c.label} <span className="num">{c.symbol}</span>
    </span>
  );
}
