'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'polynuts:theme';

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function systemPref(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Suppress every transition for the duration of the swap — see globals.css
  // .theme-switching rule for why. Without this, swapping dark↔light on the
  // markets grid (~250 cards) interpolates thousands of colors in parallel.
  root.classList.add('theme-switching');
  root.dataset.theme = theme;
  // Force reflow so the class application takes effect before we remove it.
  void root.offsetHeight;
  // Drop the suppressor on the next frame — single instant repaint, no lag.
  requestAnimationFrame(() => {
    root.classList.remove('theme-switching');
  });
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => readStored() ?? systemPref());
  // The server renders with the SSR default ('dark') since it can't read the
  // stored/system theme; the real value is only known after mount. Reporting
  // the real theme on the first CLIENT render would mismatch the server HTML
  // for any theme-conditional markup (the toggle icon, RainbowKit's injected
  // styles) and force React to re-render that subtree — a visible flash. So
  // report 'dark' until mounted, then the real theme. The pre-hydration boot
  // script already set <html data-theme>, so the *visual* theme is correct
  // from first paint via CSS; this gate only affects JS-conditional rendering.
  // `theme` (internal state) stays real so applyTheme + persistence operate on
  // the user's actual choice — only the returned value is gated.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  // Follow system changes only when user hasn't explicitly chosen
  useEffect(() => {
    if (readStored()) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return {
    theme: mounted ? theme : 'dark',
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}

/**
 * Inline script that runs before React hydrates — sets data-theme on the
 * <html> element to avoid a light-mode flash before useTheme mounts.
 */
export const themeBootScript = `
(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');
if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.dataset.theme=t;}catch(e){}})();
`;
