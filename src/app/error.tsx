'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for client-side telemetry / dev console; the digest links a
    // user-facing error to the server log without leaking the stack trace.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="font-display select-none text-2xl font-bold tracking-tight">
        <span className="text-brand">poly</span>
        <span className="text-text">nuts</span>
      </div>

      <h1 className="mt-8 text-xl font-bold text-text">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-text-muted">
        We hit an unexpected error loading this page. Your funds and positions are
        unaffected — this is a display issue. Try again, or head back to the markets.
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
        <Link
          href="/"
          className="press-scale rounded-md border border-line bg-bg-elev px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
        >
          Back to markets
        </Link>
      </div>
    </div>
  );
}
