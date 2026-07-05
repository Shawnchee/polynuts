'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/**
 * reel.tsx — the studio-reel motion kit for marketing surfaces (landing +
 * waitlist). A hand-rolled, dependency-free port of the design system's
 * motion patterns (see docs: masked line reveal, fade-in on view, scroll
 * progress, velocity marquee, parallax layers), built on CSS keyframes,
 * IntersectionObserver and rAF instead of framer-motion.
 *
 * Contract shared by every export:
 *  - decorative pieces are aria-hidden and pointer-events-none; the page must
 *    read identically with all of them deleted.
 *  - under prefers-reduced-motion each piece renders its static end-state
 *    (JS loops never start; CSS entrances collapse via the global
 *    reduced-motion override in globals.css).
 *  - rAF loops are gated by IntersectionObserver + visibilitychange so
 *    nothing animates off-screen or in a hidden tab.
 */

export const ACCENT = '#60a5fa';

/** The one easing curve for entrances — expo-out with a long tail. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Hero storyboard timing (seconds from mount) — tune the sequence here. */
export const TIMING = {
  navIn: 0,
  heroLabel: 0.1,
  heroLine: 0.25,
  heroLineStagger: 0.11,
  heroSub: 0.8,
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false // SSR: assume motion; JS loops only start client-side anyway
  );
}

/**
 * Top-of-page accent progress bar. Direct scroll mapping (no easing), so it
 * stays honest under reduced motion — it's a position indicator, not motion.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left"
      style={{ background: ACCENT, transform: 'scaleX(0)' }}
    />
  );
}

/**
 * Masked line reveal — the headline entrance. The inner span swings up out of
 * an overflow-hidden wrapper with a slight rotation. Pure CSS (keyframes in
 * globals.css), so it fires on load without waiting for hydration.
 */
export function MaskedLine({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={`block overflow-hidden ${className}`}>
      <span className="reel-mask-line block" style={delay ? { animationDelay: `${delay}s` } : undefined}>
        {children}
      </span>
    </span>
  );
}

/**
 * Fade-in on view — the default reveal for section content. Fires slightly
 * before fully in view (-12% bottom margin), once. Stagger siblings with
 * delay={i * 0.08}.
 */
export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reel-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('reel-in');
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reel-fade ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Parallax layer — decorative depth. The outer div is measured (never
 * transformed); the inner div drifts ±range/2 px as the layer crosses the
 * viewport. Positive range drifts down with scroll, negative drifts up —
 * pair one of each for the two-layer divergence that sells depth.
 */
export function ParallaxLayer({
  children,
  range = 60,
  className = '',
}: {
  children?: ReactNode;
  range?: number;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    if (reduced) {
      inner.style.transform = '';
      return;
    }
    let raf = 0;
    let inView = true;
    const update = () => {
      raf = 0;
      const rect = outer.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
      inner.style.transform = `translate3d(0, ${((progress - 0.5) * range).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (inView && !raf) raf = requestAnimationFrame(update);
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            inView = e.isIntersecting;
            if (inView) onScroll();
          }
        },
        { threshold: 0 }
      );
      io.observe(outer);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [range, reduced]);
  return (
    <div ref={outerRef} aria-hidden className={`pointer-events-none ${className}`}>
      {/* relative so absolutely-positioned children (e.g. the canvas motif)
          size against this transformed layer, not the section behind it */}
      <div ref={innerRef} className="relative h-full w-full">
        {children}
      </div>
    </div>
  );
}

/**
 * Ghost word — an enormous hollow display word parallaxing behind content.
 * Size it with a text-[NNvw] class on `className`; position with absolute
 * offsets. Stroke only, transparent fill, very low alpha.
 */
export function GhostWord({
  children,
  range = -120,
  className = '',
}: {
  children: string;
  range?: number;
  className?: string;
}) {
  return (
    <ParallaxLayer range={range} className={`absolute select-none ${className}`}>
      <span
        className="block font-display font-extrabold uppercase leading-none text-transparent"
        style={{ WebkitTextStroke: '1px rgba(237, 240, 246, 0.09)' }}
      >
        {children}
      </span>
    </ParallaxLayer>
  );
}

/**
 * Velocity marquee — an infinite band of display terms whose speed and skew
 * follow scroll velocity. Texture, not content: aria-hidden, static single
 * row under reduced motion. Two duplicated runs + modulo wrap = seamless loop.
 */
export function VelocityMarquee({ items, className = '' }: { items: string[]; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const row = rowRef.current;
    if (!wrap || !row) return;
    if (reduced) {
      row.style.transform = '';
      return;
    }

    let half = row.scrollWidth / 2;
    let offset = 0;
    let vel = 0;
    let skew = 0;
    let raf = 0;
    let running = false;
    let inView = false;
    let lastT = 0;
    let lastY = window.scrollY;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            half = row.scrollWidth / 2;
          })
        : null;
    ro?.observe(row);

    const tick = (t: number) => {
      if (!running) return;
      const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      const y = window.scrollY;
      const instVel = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      // Damped follow — approximates a spring without a physics lib.
      vel += (instVel - vel) * Math.min(1, dt * 8);
      const targetSkew = Math.max(-4, Math.min(4, vel / 320));
      skew += (targetSkew - skew) * Math.min(1, dt * 10);
      const speed = 70 * (1 + Math.min(Math.abs(vel) / 900, 3)); // px/s, scroll-boosted
      offset = (offset + speed * dt) % (half || 1);
      row.style.transform = `translate3d(${(-offset).toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      lastT = 0;
      lastY = window.scrollY;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            inView = e.isIntersecting;
            if (inView) start();
            else stop();
          }
        },
        { threshold: 0 }
      );
      io.observe(wrap);
    } else {
      inView = true;
      start();
    }
    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  const doubled = [...items, ...items];
  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={`pointer-events-none overflow-hidden border-y border-white/[0.06] bg-white/[0.01] py-5 ${className}`}
    >
      <div ref={rowRef} className="flex w-max items-center whitespace-nowrap will-change-transform">
        {doubled.map((term, i) => (
          <span
            key={i}
            className="flex items-center font-display text-lg font-bold uppercase tracking-[0.22em] text-white/40 sm:text-xl"
          >
            <span className="px-6 sm:px-8">{term}</span>
            <span className="text-sm" style={{ color: ACCENT, opacity: 0.6 }}>
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pulsing scroll cue for the hero — static line under reduced motion. */
export function ScrollCue({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none flex flex-col items-center gap-2 ${className}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">Scroll</span>
      <span className="reel-cue block h-8 w-px origin-top bg-white/25" />
    </div>
  );
}
