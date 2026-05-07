'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtTimeLeft, isUrgent } from '@/lib/utils';

export function TimerBadge({ expirySec }: { expirySec: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const urgent = isUrgent(expirySec);
  return (
    <span
      key={tick}
      className={cn(
        'num text-sm tabular-nums',
        urgent ? 'text-dump font-semibold' : 'text-ink-600'
      )}
    >
      {fmtTimeLeft(expirySec)}
    </span>
  );
}
