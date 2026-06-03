import { cn } from '@/lib/utils';
import type { Direction } from '@/lib/sdk/markets';
import { ArrowDown, ArrowRightLeft, ArrowUp } from 'lucide-react';

const map: Record<
  Direction,
  { label: string; cls: string; Icon: typeof ArrowUp }
> = {
  PUMP: {
    label: 'PUMP',
    cls: 'bg-pump-light dark:bg-pump/15 text-pump dark:text-pump-dark border-pump/30',
    Icon: ArrowUp,
  },
  DUMP: {
    label: 'DUMP',
    cls: 'bg-dump-light dark:bg-dump/15 text-dump dark:text-dump-dark border-dump/30',
    Icon: ArrowDown,
  },
  RANGE: {
    label: 'RANGE',
    cls: 'bg-range-light dark:bg-range/15 text-range dark:text-range-dark border-range/30',
    Icon: ArrowRightLeft,
  },
};

export function DirectionTag({
  direction,
  size = 'sm',
}: {
  direction: Direction;
  size?: 'sm' | 'md';
}) {
  const c = map[direction];
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-bold uppercase tabular-nums leading-none tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        c.cls
      )}
    >
      <Icon
        className={size === 'sm' ? 'h-2.5 w-2.5 stroke-[3]' : 'h-3.5 w-3.5 stroke-[3]'}
        aria-hidden
      />
      {c.label}
    </span>
  );
}
