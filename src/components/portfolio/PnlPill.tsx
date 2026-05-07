import { cn } from '@/lib/utils';

export function PnlPill({ amount, digits = 2 }: { amount: number; digits?: number }) {
  const positive = amount >= 0;
  return (
    <span
      className={cn(
        'num font-semibold tabular-nums',
        positive ? 'text-pump dark:text-pump-dark' : 'text-dump dark:text-dump-dark'
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
