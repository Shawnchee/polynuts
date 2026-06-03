'use client';

import { useEffect } from 'react';
import './globals.css';

// Root error boundary. When this renders, the root layout has crashed, so we
// must supply our own <html>/<body>. We import globals.css here so the theme
// tokens (bg/surface/text/brand) and Tailwind utilities resolve exactly as in
// the normal shell, keeping the fallback on-brand.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body>
        <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-text">
          <div className="select-none text-2xl font-bold tracking-tight">
            <span className="text-brand">poly</span>
            <span className="text-text">nuts</span>
          </div>

          <h1 className="mt-8 text-xl font-bold text-text">Something went wrong</h1>
          <p className="mt-3 max-w-md text-sm text-text-muted">
            Polynuts ran into an unexpected error. Your funds and positions are
            unaffected. Reload to get back to the markets.
          </p>
          {error.digest ? (
            <p className="num mt-3 text-xs tabular-nums text-text-dim">
              Reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="press-scale rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Try again
            </button>
            <a
              href="/"
              className="press-scale rounded-md border border-line bg-bg-elev px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
            >
              Back to markets
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
