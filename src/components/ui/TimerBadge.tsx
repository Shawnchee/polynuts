'use client';

import { useEffect, useState } from 'react';
import { cn, isUrgent } from '@/lib/utils';
import { Clock } from 'lucide-react';

/**
 * Expiry display — anchored to the absolute UTC settlement time so it
 * doesn't visually "tick down" as the page sits open. Shows:
 *
 *   - same UTC day:        "13:00 UTC"
 *   - tomorrow:            "Tom 08:00"
 *   - within ~7 days:      "Sat 08:00"
 *   - further out:         "May 22"
 *
 * Re-renders every 60s so the day-relative labels (today/tomorrow) flip
 * after midnight UTC. The label is fixed, not a countdown.
 */
export function TimerBadge({ expirySec }: { expirySec: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const valid = Number.isFinite(expirySec);
  const urgent = valid && isUrgent(expirySec);
  const label = valid ? fmtAbsoluteExpiry(expirySec) : '—';
  return (
    <span
      className={cn(
        'num inline-flex items-center gap-1 text-xs tabular-nums leading-none',
        urgent ? 'text-dump font-semibold' : 'text-text-muted'
      )}
      title={valid ? new Date(expirySec * 1000).toUTCString() : undefined}
      aria-label={valid ? `Settles ${label}${urgent ? ' (closing soon)' : ''}` : 'Settlement time unavailable'}
    >
      <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

function fmtAbsoluteExpiry(expirySec: number): string {
  const d = new Date(expirySec * 1000);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });

  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) return `${time} UTC`;

  const tomorrow = new Date(now.getTime() + 86400_000);
  const isTomorrow =
    d.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    d.getUTCMonth() === tomorrow.getUTCMonth() &&
    d.getUTCDate() === tomorrow.getUTCDate();
  if (isTomorrow) return `Tom ${time}`;

  const dt = expirySec - Math.floor(now.getTime() / 1000);
  if (dt > 0 && dt < 7 * 86400) {
    const weekday = d.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return `${weekday} ${time}`;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
