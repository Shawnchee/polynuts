'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PixelIcon } from '@/components/landing/PixelIcon';
import { LandingStats } from '@/components/landing/LandingStats';
import { LiveMarkets } from '@/components/landing/LiveMarkets';
import { SpotTicker } from '@/components/landing/SpotTicker';
import { HeroAppPreview } from '@/components/landing/HeroAppPreview';
import { HeroBackground } from '@/components/landing/HeroBackground';
import { HeroDemo } from '@/components/landing/HeroDemo';
import {
  ACCENT,
  TIMING,
  FadeIn,
  GhostWord,
  MaskedLine,
  ParallaxLayer,
  ScrollCue,
  ScrollProgress,
  VelocityMarquee,
} from '@/components/landing/reel';

/**
 * Landing page — studio-reel edition.
 *
 * Storyboard (times from mount):
 *   0ms          nav rises in
 *   100ms        hero badge + spot ticker rise in
 *   250–360ms    two headline lines swing out of their masks (stagger 110ms)
 *   350ms        app-window preview rises in on the right
 *   800ms        hero sub + CTAs + direction legend rise in
 *   scroll ▼     accent progress bar tracks the page; candle field drifts
 *                down while the ghost PUMP word drifts up — two-layer depth
 *   scroll ▼     velocity marquee skews & speeds with scroll velocity
 *   scroll ▼     numbered sections (01–04) fade-rise in on view
 *   end          full-viewport CTA — one huge link over the quiet candle field
 *
 * Reduced motion: every entrance collapses to its end state (globals.css
 * zeroes durations + delays), the marquee/parallax loops never start, and the
 * candle canvas renders a single static frame.
 */

const CONTAINER = 'mx-auto w-full max-w-page px-6 sm:px-10 lg:px-16';
const H2 = 'font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl';
const SERIF = 'font-serif italic font-normal tracking-[-0.01em]';

const DIR_COLOR: Record<string, string> = {
  PUMP: 'text-green-400',
  DUMP: 'text-rose-400',
  RANGE: 'text-violet-400',
};

const MARQUEE_TERMS = [
  'PUMP',
  'DUMP',
  'RANGE',
  'BTC',
  'ETH',
  'FIXED RISK',
  'ON-CHAIN',
  'USDC',
  'BASE MAINNET',
];

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
    title: 'Win or lose — settled at expiry',
    body: 'At expiry, the on-chain oracle records the price and the market settles automatically. Winners collect their USDC payout on-chain — no claim needed.',
  },
];

const FEATURES = [
  {
    kicker: 'Custody',
    title: 'Non-custodial',
    body: 'Your USDC, your keys. Smart contracts handle every fill and settlement — no withdrawal requests, no KYC.',
  },
  {
    kicker: 'Speed',
    title: 'Sub-second fills',
    body: 'Bets execute on Base in ~2s. Gas is pinned to 80k so your wallet popup appears immediately, even on slow RPCs.',
  },
  {
    kicker: 'Pricing',
    title: 'Real-time odds',
    body: 'Implied probability and max multiplier are computed on-chain via simulatePayout — not a marketing estimate.',
  },
  {
    kicker: 'Infrastructure',
    title: 'Powered by Thetanuts V4',
    body: 'Polynuts is a front-end for Thetanuts Finance V4 structured-product vaults — audited, live since 2021.',
  },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-[#131720] text-white antialiased">
      <ScrollProgress />

      {/* ── Top nav ── */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#131720]/70 backdrop-blur-xl">
        <div
          className={`${CONTAINER} reel-rise flex items-center justify-between py-3.5`}
          style={{ animationDelay: `${TIMING.navIn}s` }}
        >
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

      {/* ── Hero — three planes: candle field (down), ghost word (up), copy ── */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-28">
        <ParallaxLayer range={70} className="absolute inset-0">
          <HeroBackground />
        </ParallaxLayer>
        <GhostWord range={-140} className="bottom-[3vh] left-[-2vw] text-[20vw]">
          PUMP
        </GhostWord>

        <div className={`relative z-10 ${CONTAINER}`}>
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Copy — left-aligned, asymmetric. Centered-everything is the #1 AI-slop tell. */}
            <div className="flex flex-col items-start gap-6 text-left">
              <div
                className="reel-rise flex flex-col items-start gap-4"
                style={{ animationDelay: `${TIMING.heroLabel}s` }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  Live on Base mainnet
                </div>
                <SpotTicker />
              </div>

              <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
                <MaskedLine delay={TIMING.heroLine}>
                  Trade the{' '}
                  <span className={SERIF} style={{ color: ACCENT }}>
                    moment
                  </span>
                  .
                </MaskedLine>
                <MaskedLine delay={TIMING.heroLine + TIMING.heroLineStagger}>On-chain.</MaskedLine>
              </h1>

              <p
                className="reel-rise max-w-md text-base leading-relaxed text-white/55 sm:text-lg"
                style={{ animationDelay: `${TIMING.heroSub}s` }}
              >
                Bet whether BTC or ETH will pump, dump, or range — in the next hour, day,
                or week. Fixed risk. Settles on-chain at expiry. No custody.
              </p>

              <div
                className="reel-rise flex flex-wrap items-center gap-3 pt-1"
                style={{ animationDelay: `${TIMING.heroSub + 0.1}s` }}
              >
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
                    document.getElementById('how')?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 'auto'
                        : 'smooth',
                    });
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-base font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  How it works
                </a>
              </div>

              {/* Direction legend — mono, restrained */}
              <div
                className="reel-rise flex items-center gap-4 pt-2 font-mono text-xs text-white/40"
                style={{ animationDelay: `${TIMING.heroSub + 0.18}s` }}
              >
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
            <div className="reel-rise w-full lg:pl-4" style={{ animationDelay: '0.35s' }}>
              <HeroAppPreview />
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-7 hidden justify-center lg:flex">
          <ScrollCue />
        </div>
      </section>

      {/* ── Velocity marquee — texture, not content (aria-hidden) ── */}
      <VelocityMarquee items={MARQUEE_TERMS} />

      {/* ── 01 · See it in action — the rendered product walkthrough ── */}
      <section aria-label="See it in action" className="relative overflow-hidden">
        <GhostWord range={-110} className="right-[-2vw] top-24 text-[17vw]">
          01
        </GhostWord>
        <div className={`relative ${CONTAINER} py-28 md:py-40`}>
          <FadeIn className="max-w-xl">
            <Kicker>01 — See it in action</Kicker>
            <h2 className={H2}>
              One bet, start
              <br />
              to <span className={SERIF} style={{ color: ACCENT }}>settled</span>.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mx-auto mt-14 max-w-4xl">
              <HeroDemo />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Stats strip (real protocol numbers) ── */}
      <LandingStats />

      {/* ── 02 · Live markets table (real order book) ── */}
      <LiveMarkets />

      {/* ── 03 · How it works — editorial, big left heading + divided columns ── */}
      <section
        id="how"
        aria-label="How it works"
        className="relative scroll-mt-24 overflow-hidden border-t border-white/[0.06]"
      >
        <GhostWord range={-110} className="right-[-2vw] top-20 text-[17vw]">
          03
        </GhostWord>
        <div className={`relative ${CONTAINER} py-28 md:py-40`}>
          <FadeIn className="mb-14 max-w-xl">
            <Kicker>03 — How it works</Kicker>
            <h2 className={H2}>
              Three steps to
              <br />
              your <span className={SERIF} style={{ color: ACCENT }}>first bet</span>.
            </h2>
          </FadeIn>

          {/* gap-px over a tinted container paints the hairline dividers between cells */}
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.07] sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.08} className="h-full">
                <div className="flex h-full flex-col gap-5 bg-[#131720] p-7">
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
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 · Why Polynuts — list-as-hero: type does the heavy lifting ── */}
      <section aria-label="Why Polynuts" className="relative overflow-hidden border-t border-white/[0.06]">
        <GhostWord range={-110} className="right-[-2vw] top-20 text-[17vw]">
          04
        </GhostWord>
        <div className={`relative ${CONTAINER} py-28 md:py-40`}>
          <FadeIn className="mb-14 max-w-xl">
            <Kicker>04 — Why Polynuts</Kicker>
            <h2 className={H2}>
              Real options
              <br />
              <span className={SERIF} style={{ color: ACCENT }}>under the hood</span>.
            </h2>
          </FadeIn>

          <div className="border-t border-white/[0.08]">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.06}>
                <div className="group grid gap-3 border-b border-white/[0.08] py-8 md:grid-cols-[9rem_1fr_minmax(0,22rem)] md:items-baseline md:gap-8">
                  <div className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
                    <span style={{ color: ACCENT }}>{String(i + 1).padStart(2, '0')}</span>
                    {f.kicker}
                  </div>
                  <h3 className="font-display text-3xl font-bold tracking-tight text-white transition-[transform,color] duration-300 ease-smooth sm:text-5xl md:group-hover:translate-x-2 md:group-hover:text-[#60a5fa]">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/45 transition-opacity duration-300 md:text-right md:opacity-60 md:group-hover:opacity-100">
                    {f.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 · Final CTA — full-viewport, one huge link over the quiet field ── */}
      <section
        aria-label="Start trading"
        className="relative flex min-h-[85vh] items-center overflow-hidden border-t border-white/[0.06]"
      >
        <HeroBackground variant="cta" />
        <div className={`relative z-10 ${CONTAINER} py-28 md:py-40`}>
          <FadeIn>
            <Kicker>05 — Ready?</Kicker>
          </FadeIn>
          <FadeIn delay={0.08}>
            <Link
              href="/markets"
              className="group block w-fit rounded-xl font-display text-[clamp(3.2rem,10vw,9.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-white transition-colors duration-300 hover:text-[#60a5fa]"
            >
              Start <span className={SERIF}>trading</span>
              <ArrowUpRight
                aria-hidden
                className="ml-[0.06em] inline-block h-[0.7em] w-[0.7em] transition-transform duration-300 ease-smooth group-hover:-translate-y-2 group-hover:translate-x-2"
              />
            </Link>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-8 font-mono text-xs text-white/40 sm:text-sm">
              240+ live markets · real USDC · settles on-chain at expiry
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06]">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4 py-10 text-xs text-white/30`}>
          <span className="flex items-center gap-2.5 font-mono">
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
              Public Beta
            </span>
            <span>
              <span style={{ color: ACCENT }}>poly</span>nuts — powered by Thetanuts V4
            </span>
          </span>
          <div className="flex gap-6 font-mono">
            <Link href="/markets" className="transition-colors hover:text-white/70">Markets</Link>
            <Link href="/leaderboard" className="transition-colors hover:text-white/70">Leaderboard</Link>
            <a
              href="https://thetanuts.finance"
              target="_blank"
              rel="noopener noreferrer"
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
