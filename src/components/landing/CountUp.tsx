'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function CountUp({
  to,
  from = 0,
  duration = 2,
  separator = ',',
  prefix = '',
  suffix = '',
  decimals,
  className = '',
}: CountUpProps) {
  const [value, setValue] = useState(from);
  const elRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          obs.disconnect();
          animate();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function animate() {
    const start = performance.now();
    const range = to - from;

    function step(now: number) {
      const elapsed = (now - start) / (duration * 1000);
      const progress = Math.min(elapsed, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + range * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const dec = decimals ?? (String(to).includes('.') ? String(to).split('.')[1].length : 0);
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).replace(/,/g, separator);

  return (
    <span ref={elRef} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
