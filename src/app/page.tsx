'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PixelIcon } from '@/components/landing/PixelIcon';
import { LandingStats } from '@/components/landing/LandingStats';
import { LiveMarkets } from '@/components/landing/LiveMarkets';
import { SpotTicker } from '@/components/landing/SpotTicker';
import { HeroAppPreview } from '@/components/landing/HeroAppPreview';

const ACCENT = '#60a5fa';

const DIR_COLOR: Record<string, string> = {
  PUMP: 'text-green-400',
  DUMP: 'text-rose-400',
  RANGE: 'text-violet-400',
};

const STEPS = [
  {
    step: '01',
    icon: 'market',
    title: 'Pick a market',
    body: 'Browse live BTC and ETH options expiring today, tomorrow, or next week. Every market resolves on-chain — no counterparty, no custody.',
  },
  {
    step: '02',
    icon: 'direction',
    title: 'Choose your direction',
    body: 'PUMP if you think price finishes above the strike. DUMP if below. RANGE if it stays inside the band. Your max loss is always your bet.',
    chips: ['PUMP', 'DUMP', 'RANGE'],
  },
  {
    step: '03',
    icon: 'settle',
    title: 'Win or lose — instantly',
    body: 'When the market settles, the on-chain oracle records the price. Winners collect their USDC payout automatically — no claim needed.',
  },
];

const FEATURES = [
  {
    icon: 'lock',
    kicker: 'Custody',
    title: 'Non-custodial',
    body: 'Your USDC, your keys. Smart contracts handle every fill and settlement — no withdrawal requests, no KYC.',
  },
  {
    icon: 'bolt',
    kicker: 'Speed',
    title: 'Sub-second fills',
    body: 'Bets execute on Base in ~2s. Gas is pinned to 80k so your wallet popup appears immediately, even on slow RPCs.',
  },
  {
    icon: 'odds',
    kicker: 'Pricing',
    title: 'Real-time odds',
    body: 'Implied probability and max multiplier are computed on-chain via simulatePayout — not a marketing estimate.',
  },
  {
    icon: 'layers',
    kicker: 'Infrastructure',
    title: 'Powered by Thetanuts V4',
    body: 'Polynuts is a front-end for Thetanuts Finance V4 structured-product vaults — audited, live since 2021.',
  },
];


export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#131720] text-white antialiased">

      {/* ── Top nav ── */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#131720]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            <span style={{ color: ACCENT }}>poly</span>
            <span className="text-white">nuts</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] text-white/50 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              BASE · LIVE
            </span>
            <Link
              href="/markets"
              className="press-scale flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#131720] transition-colors hover:bg-white/90"
            >
              Launch app <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden px-6 pb-16 pt-28">
        {/* Flat blueprint grid — replaces the WebGL aurora. No glow. */}
        <div className="pointer-events-none absolute inset-0 grid-bg" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Copy — left-aligned, asymmetric. Centered-everything is the #1 AI-slop tell. */}
          <div className="flex flex-col items-start gap-6 text-left">
            <div className="flex flex-col items-start gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                Live on Base mainnet
              </div>
              <SpotTicker />
            </div>

            <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
              Trade the moment.
              <span className="mt-1 block" style={{ color: ACCENT }}>
                On-chain.
              </span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
              Bet whether BTC or ETH will pump, dump, or range — in the next hour, day,
              or week. Fixed risk. Instant settlement. No custody.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/markets"
                className="group press-scale flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[#131720] transition-all hover:brightness-110"
                style={{ background: ACCENT }}
              >
                Start trading
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-base font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                How it works
              </a>
            </div>

            {/* Direction legend — mono, restrained */}
            <div className="flex items-center gap-4 pt-2 font-mono text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> PUMP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> DUMP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> RANGE
              </span>
            </div>
          </div>

          {/* Product-as-hero — the real markets surface, live, framed as an app window. */}
          <div className="w-full lg:pl-4">
            <HeroAppPreview />
          </div>
        </div>
      </section>

      {/* ── Stats strip (real protocol numbers) ── */}
      <LandingStats />

      {/* ── Live markets table (real order book) ── */}
      <LiveMarkets />

      {/* ── How it works — editorial, big left heading + divided columns ── */}
      <section id="how" className="relative scroll-mt-24 border-t border-white/[0.06] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
              How it works
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              Three steps to
              <br />
              your first bet
            </h2>
          </div>

          {/* gap-px over a tinted container paints the hairline dividers between cells */}
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.07] sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="flex flex-col gap-5 bg-[#131720] p-7">
                <div className="flex items-center justify-between">
                  <PixelIcon name={s.icon} className="h-8 w-8" style={{ color: ACCENT }} />
                  <span className="font-mono text-sm font-medium text-white/25">{s.step}</span>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-white">{s.title}</h3>
                    {s.chips && (
                      <div className="flex gap-1.5 font-mono text-[10px] font-semibold">
                        {s.chips.map((c) => (
                          <span key={c} className={DIR_COLOR[c]}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-white/50">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Polynuts — same editorial system, four columns ── */}
      <section className="relative border-t border-white/[0.06] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
              Why Polynuts
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              Real options
              <br />
              under the hood
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-5 bg-[#131720] p-7">
                <PixelIcon name={f.icon} className="h-8 w-8" style={{ color: ACCENT }} />
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
                    {f.kicker}
                  </p>
                  <h3 className="mb-1.5 font-display text-base font-bold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-white/45">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative px-6 py-28">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] px-8 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(to right, transparent, ${ACCENT}99, transparent)` }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Ready to trade?
              </h2>
              <p className="mx-auto mb-9 mt-4 max-w-md font-mono text-sm text-white/45">
                243 live markets · real money · on-chain settlement
              </p>
              <Link
                href="/markets"
                className="group press-scale inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold text-[#131720] transition-all hover:brightness-110"
                style={{ background: ACCENT }}
              >
                Open the app
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-white/30">
          <span className="font-mono">
            <span style={{ color: ACCENT }}>poly</span>nuts — powered by Thetanuts V4
          </span>
          <div className="flex gap-6 font-mono">
            <Link href="/markets" className="transition-colors hover:text-white/70">Markets</Link>
            <Link href="/leaderboard" className="transition-colors hover:text-white/70">Leaderboard</Link>
            <a
              href="https://thetanuts.finance"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 transition-colors hover:text-white/70"
            >
              Thetanuts <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
