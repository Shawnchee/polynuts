'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Slim top progress bar for client route navigations — app-wide (landing + app
 * pages). Mounted globally in app/layout.tsx so it covers every route.
 *
 * Why this implementation:
 *   Next 16 exposes `useLinkStatus()`, but it is *scoped*: it only reports the
 *   pending state of the single <Link> it is rendered inside, so it can't give a
 *   global "a navigation is happening" signal without instrumenting every link.
 *   The reliable global primitives are `usePathname()` / `useSearchParams()`,
 *   which change exactly when a navigation commits. So we:
 *     1. Start the bar the moment the user *initiates* an internal navigation —
 *        a capture-phase click on an in-app <a>, or a back/forward (popstate).
 *     2. Creep it toward ~90% (indeterminate — we don't know real progress),
 *        which gives the YouTube/NProgress feel while the route resolves.
 *     3. Complete to 100% and fade out when the pathname / query commits.
 *   This avoids any external dependency and works for the landing page too.
 *
 * Reduced motion: globals.css already collapses animation/transition durations
 * under `prefers-reduced-motion: reduce`. We additionally honor it here — when
 * the user prefers reduced motion we skip the creep/transition and just flash
 * the completed bar briefly, so there's a non-jarring "navigated" acknowledgement
 * without sliding motion.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams?.toString() ?? ''}`;

  // Render state: visible + width (0–100). `null` width means "not active".
  const [progress, setProgress] = useState<number | null>(null);
  const creepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const reduced = useRef(false);

  // Cache the reduced-motion preference (and keep it live if the user toggles).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const clearTimers = () => {
    if (creepTimer.current) {
      clearInterval(creepTimer.current);
      creepTimer.current = null;
    }
    if (doneTimer.current) {
      clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
  };

  // ── Start: the user initiated a navigation (click on an internal link, or a
  // browser back/forward). We can't know real progress, so we creep toward 90%.
  useEffect(() => {
    const start = () => {
      clearTimers();
      if (reduced.current) {
        // No creep animation — just show a near-full bar; the pathname-commit
        // effect below will finish + hide it.
        setProgress(90);
        return;
      }
      setProgress(8);
      creepTimer.current = setInterval(() => {
        setProgress((p) => {
          if (p == null) return p;
          if (p >= 90) return p; // hold near the end until navigation commits
          // Ease the creep: bigger steps early, smaller as it approaches 90%.
          const step = p < 40 ? 9 : p < 70 ? 4 : 1.5;
          return Math.min(90, p + step);
        });
      }, 220);
    };

    const onClick = (e: MouseEvent) => {
      // Ignore modified clicks / non-primary buttons (new tab, etc.).
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // External / new-tab / download links don't trigger a client navigation.
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;
      // Same URL → no navigation will occur.
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) {
        return;
      }
      start();
    };

    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('popstate', start);
    };
  }, []);

  // ── Commit: pathname/query changed → the navigation resolved. Snap to 100%,
  // then fade out. Skip the very first render (initial page load, not a nav).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    clearTimers();
    setProgress(100);
    doneTimer.current = setTimeout(() => setProgress(null), reduced.current ? 160 : 320);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => clearTimers(), []);

  const active = progress != null;
  const finishing = progress === 100;

  return (
    <div
      aria-hidden
      className="nav-progress"
      data-active={active ? '' : undefined}
      data-finishing={finishing ? '' : undefined}
    >
      <div
        className="nav-progress__bar"
        style={{ width: active ? `${progress}%` : '0%' }}
      />
      <style jsx>{`
        .nav-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          z-index: 60;
          pointer-events: none;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .nav-progress[data-active] {
          opacity: 1;
        }
        /* Fade out as the bar completes so the 100% snap reads as "arrived". */
        .nav-progress[data-finishing] {
          opacity: 0;
          transition: opacity 200ms ease 120ms;
        }
        .nav-progress__bar {
          height: 100%;
          /* Brand accent — #60a5fa is the dark-theme brand; light theme reads
             the slightly deeper #2563eb. A subtle leading glow gives it lift. */
          background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
          box-shadow:
            0 0 8px rgba(96, 165, 250, 0.6),
            0 0 2px rgba(96, 165, 250, 0.9);
          border-radius: 0 2px 2px 0;
          transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: width;
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-progress,
          .nav-progress[data-finishing] {
            transition: opacity 0.001ms !important;
          }
          .nav-progress__bar {
            transition: none !important;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
