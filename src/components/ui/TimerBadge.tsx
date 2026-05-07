'use client';

import { useEffect, useState } from 'react';
import { cn, fmtTimeLeft, isUrgent } from '@/lib/utils';
import { Clock } from 'lucide-react';

export function TimerBadge({ expirySec }: { expirySec: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const urgent = isUrgent(expirySec);
  return (
    <span
      className={cn(
        'num inline-flex items-center gap-1 text-xs tabular-nums',
        urgent ? 'text-dump font-semibold' : 'text-text-muted'
      )}
    >
      <Clock className="h-2.5 w-2.5" aria-hidden />
      {fmtTimeLeft(expirySec)}
    </span>
  );
}
