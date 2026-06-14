'use client';

import { useId, useState, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight CSS-only-ish tooltip — no Radix dependency, opens on hover
 * for desktop, on focus for keyboard users, and on tap for mobile
 * (then auto-dismisses on outside click / blur / Escape).
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={open ? tipId : undefined}
      className={cn(
        'relative inline-flex rounded-sm outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {children}
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            'absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2',
            'w-56 rounded-md border border-line bg-bg-elev px-3 py-2',
            'text-xs leading-snug text-text shadow-lg',
            'animate-fade-in-down'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
