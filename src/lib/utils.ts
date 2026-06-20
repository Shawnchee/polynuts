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
  // Guard non-finite input centrally so no caller can ever render "$NaN".
  if (!Number.isFinite(amount)) return '$0.00';
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
  if (!Number.isFinite(pct)) return '—';
  return `${pct.toFixed(digits)}%`;
}

export function fmtTimeLeft(expirySec: number) {
  if (!Number.isFinite(expirySec)) return '—';
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

/** Compact "time since" label for an ISO timestamp, e.g. "3m ago", "2h ago". */
export function fmtTimeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'just now';
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
