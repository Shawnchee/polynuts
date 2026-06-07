'use client';

import { useRef, type ReactNode } from 'react';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(255,255,255,0.07)',
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    el.style.setProperty('--spotlight-color', spotlightColor);
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`spotlight-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </div>
  );
}
