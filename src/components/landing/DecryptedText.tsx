'use client';

import { useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$@#%&';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover';
}

export function DecryptedText({
  text,
  speed = 60,
  delay = 0,
  className = '',
  encryptedClassName = 'text-white/30',
  animateOn = 'view',
}: DecryptedTextProps) {
  const [displayed, setDisplayed] = useState<string[]>(() => text.split('').map(() => ' '));
  const [revealedCount, setRevealedCount] = useState(0);
  const elRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  function startAnimation() {
    if (started.current) return;
    started.current = true;
    let count = 0;
    const chars = text.split('');

    function tick() {
      count++;
      setRevealedCount(count);
      setDisplayed(
        chars.map((c, i) =>
          i < count ? c : c === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]
        )
      );
      if (count < chars.length) {
        rafRef.current = setTimeout(tick, speed);
      }
    }
    rafRef.current = setTimeout(tick, delay);
  }

  useEffect(() => {
    if (animateOn === 'view') {
      const el = elRef.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) { startAnimation(); obs.disconnect(); }
        },
        { threshold: 0.3 }
      );
      obs.observe(el);
      return () => { obs.disconnect(); if (rafRef.current) clearTimeout(rafRef.current); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateOn]);

  function handleMouseEnter() {
    if (animateOn !== 'hover') return;
    started.current = false;
    setRevealedCount(0);
    setDisplayed(text.split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]));
    startAnimation();
  }

  return (
    <span
      ref={elRef}
      aria-label={text}
      onMouseEnter={handleMouseEnter}
      className={className}
    >
      {displayed.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className={i >= revealedCount && c !== ' ' ? encryptedClassName : undefined}
        >
          {c}
        </span>
      ))}
    </span>
  );
}
