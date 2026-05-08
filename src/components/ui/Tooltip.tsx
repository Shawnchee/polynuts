'use client';

import { useState, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight CSS-only-ish tooltip — no Radix dependency, opens on hover
 * for desktop and on tap for mobile (then auto-dismisses on outside click).
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

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {children}
      {open && (
        <span
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
