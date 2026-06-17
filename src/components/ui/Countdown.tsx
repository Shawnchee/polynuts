'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Live countdown to a settlement timestamp. Unlike TimerBadge (which shows a
 * fixed "closes at HH:MM UTC" label), this actively ticks down second-by-
 * second — the user asked to see exactly how long is left when they open a
 * trade. Switches to a red "closing soon" tone under 30 minutes and shows
 * "Closed" once expiry passes.
 *
 *   ≥ 1 day   → "2d 4h 13m"
 *   ≥ 1 hour  → "3h 12m 45s"
 *   ≥ 1 min   → "12m 45s"
 *   < 1 min   → "45s"
 */
export function Countdown({
  expirySec,
  className,
  showIcon = true,
}: {
  expirySec: number;
  className?: string;
  showIcon?: boolean;
}) {
  // Seed from the current time and re-tick every second. Stored as the raw
  // seconds-left so the component re-renders once per second regardless of
  // how the value is formatted.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const valid = Number.isFinite(expirySec);
  const left = valid ? expirySec - now : NaN;
  const closed = valid && left <= 0;
  const urgent = valid && left > 0 && left < 30 * 60;

  return (
    <span
      className={cn(
        'num inline-flex items-center gap-1 text-xs tabular-nums leading-none',
        closed
          ? 'text-text-dim'
          : urgent
          ? 'text-dump dark:text-dump-dark font-semibold'
          : 'text-text-muted',
        className
      )}
      title={valid ? new Date(expirySec * 1000).toUTCString() : undefined}
    >
      {showIcon && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
      {closed ? 'Closed' : valid ? fmtCountdown(left) : '—'}
    </span>
  );
}

function fmtCountdown(left: number): string {
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
