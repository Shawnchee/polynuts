import { cn } from '@/lib/utils';

interface PnlPillProps {
  amount: number;
  digits?: number;
  percent?: number;
}

export function PnlPill({ amount, digits, percent }: PnlPillProps) {
  // Defensive: never render $NaN / $Infinity for a real-money figure.
  if (!Number.isFinite(amount)) {
    return <span className="num font-semibold tabular-nums text-text-dim">—</span>;
  }
  const positive = amount >= 0;
  const auto = pickDigits(amount, digits);
  const tint = positive ? 'text-pump dark:text-pump-dark' : 'text-dump dark:text-dump-dark';
  const dollarStr = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: auto,
    maximumFractionDigits: auto,
  });
  const showPct = typeof percent === 'number' && Number.isFinite(percent);
  return (
    <span className={cn('num font-semibold tabular-nums', tint)}>
      {positive ? '+' : ''}
      {dollarStr}
      {showPct && (
        <span className="ml-1 text-xs opacity-80">
          ({percent! >= 0 ? '+' : ''}
          {percent!.toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

function pickDigits(amount: number, override?: number): number {
  if (typeof override === 'number') return override;
  const abs = Math.abs(amount);
  if (abs > 0 && abs < 0.01) return 6;
  if (abs < 1) return 4;
  return 2;
}
