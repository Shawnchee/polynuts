import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(addr: string, head = 6, tail = 4) {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function fmtUsd(amount: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && Math.abs(amount) >= 1000) {
    if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  });
}

export function fmtPct(pct: number, digits = 0) {
  return `${pct.toFixed(digits)}%`;
}

export function fmtTimeLeft(expirySec: number) {
  const now = Math.floor(Date.now() / 1000);
  const left = expirySec - now;
  if (left <= 0) return 'expired';
  const days = Math.floor(left / 86400);
  const hours = Math.floor((left % 86400) / 3600);
  const mins = Math.floor((left % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function isUrgent(expirySec: number) {
  const left = expirySec - Math.floor(Date.now() / 1000);
  return left > 0 && left < 30 * 60;
}
