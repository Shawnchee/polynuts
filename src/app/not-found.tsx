import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Polynuts — Off-chain (404)',
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center animate-fade-in">
      {/* Faint grid backdrop, masked to a soft vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(127 127 127 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(127 127 127 / 0.08) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      {/* Oversized watermark — adapts to the active theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="font-display select-none text-[30vw] font-black leading-none text-text/[0.04]">
          404
        </span>
      </div>

      <div className="relative flex flex-col items-center">
        <Link
          href="/"
          aria-label="Polynuts home"
          className="font-display mb-8 flex select-none items-center text-lg font-bold tracking-tight transition-opacity hover:opacity-90"
        >
          <span className="text-brand">poly</span>
          <span className="text-text">nuts</span>
        </Link>

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">
          Error 404 · block not found
        </p>
        <h1 className="mt-4 text-3xl font-bold text-text sm:text-4xl">
          You&apos;re off-chain.
        </h1>
        <p className="mt-3 max-w-md text-sm text-text-muted sm:text-base">
          This page never settled on-chain — wrong route, bad hash, or it just
          doesn&apos;t exist. No funds were harmed.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/markets"
            className="press-scale inline-flex items-center gap-1.5 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Back to markets
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/portfolio"
            className="rounded-md border border-line px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            My portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}
