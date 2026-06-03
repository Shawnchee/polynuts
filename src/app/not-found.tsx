import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polynuts — Page not found',
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="select-none text-2xl font-bold tracking-tight">
        <span className="text-brand">poly</span>
        <span className="text-text">nuts</span>
      </div>

      <p className="num mt-8 text-2xl font-bold tabular-nums text-text-dim">404</p>
      <h1 className="mt-3 text-xl font-bold text-text">This page doesn&apos;t exist</h1>
      <p className="mt-3 max-w-md text-sm text-text-muted">
        The market or page you&apos;re looking for may have settled, moved, or never
        existed. The order book is always live on the markets page.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="press-scale rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Back to markets
        </Link>
      </div>
    </div>
  );
}
