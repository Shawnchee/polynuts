'use client';

import { Share2 } from 'lucide-react';
import { buildXIntent, buildFarcasterIntent, type ShareCardArgs } from '@/lib/share';
import { cn } from '@/lib/utils';

const X_BG = 'bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#27324A] dark:hover:bg-[#34405D]';
const FC_BG = 'bg-[#7C65C1] hover:bg-[#6952A8]';

export function ShareWinCard({
  args,
  size = 'md',
  className,
}: {
  args: ShareCardArgs;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const x = buildXIntent(args);
  const fc = buildFarcasterIntent(args);
  const padCls = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <a
        href={x}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'press-scale inline-flex items-center gap-1.5 rounded-md font-medium text-white transition-colors',
          padCls,
          X_BG
        )}
      >
        <XLogo className="h-3.5 w-3.5" />
        Share
      </a>
      <a
        href={fc}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'press-scale inline-flex items-center gap-1.5 rounded-md font-medium text-white transition-colors',
          padCls,
          FC_BG
        )}
      >
        <FarcasterLogo className="h-3.5 w-3.5" />
        Cast
      </a>
    </div>
  );
}

export function ShareIconOnly({ args }: { args: ShareCardArgs }) {
  const x = buildXIntent(args);
  return (
    <a
      href={x}
      target="_blank"
      rel="noreferrer"
      aria-label="Share win on X"
      className="press-scale inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-text hover:bg-surface-hover transition-colors"
    >
      <Share2 className="h-4 w-4" />
    </a>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.16 17.52h1.833L7.084 4.126H5.117L17.084 19.77Z" />
    </svg>
  );
}

function FarcasterLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4 4h16v16H4V4zm2.4 2.4v11.2h2.4v-4.8h6.4v4.8h2.4V6.4h-2.4v4.8H8.8V6.4H6.4z" />
    </svg>
  );
}
