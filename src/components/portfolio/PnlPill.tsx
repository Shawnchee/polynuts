import { cn } from '@/lib/utils';

export function PnlPill({ amount, digits = 2 }: { amount: number; digits?: number }) {
  const positive = amount >= 0;
  return (
    <span
      className={cn(
        'num tabular-nums font-semibold',
        positive ? 'text-pump' : 'text-dump'
      )}
    >
      {positive ? '+' : ''}
      {amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}
    </span>
  );
}
