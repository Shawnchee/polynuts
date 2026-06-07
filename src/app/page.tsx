'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight, Zap, ShieldCheck, BarChart2, Globe } from 'lucide-react';
import { Aurora } from '@/components/landing/Aurora';
import { SpotlightCard } from '@/components/landing/SpotlightCard';
import { CountUp } from '@/components/landing/CountUp';
import { DecryptedText } from '@/components/landing/DecryptedText';
import { ThemeToggle } from '@/components/nav/ThemeToggle';

const STATS = [
  { label: 'Lifetime Volume', value: 4.4, prefix: '$', suffix: 'M', decimals: 1 },
  { label: 'Total Trades', value: 10899, separator: ',', prefix: '' },
  { label: 'Active Markets', value: 243, prefix: '' },
  { label: 'Days Live', value: 241, prefix: '' },
];

const STEPS = [
  {
    step: '01',
    title: 'Pick a market',
    body: 'Browse live BTC and ETH options expiring today, tomorrow, or next week. Every market resolves on-chain — no counterparty, no custody.',
    accent: '#60a5fa',
    spotlightColor: 'rgba(37,99,235,0.15)',
  },
  {
    step: '02',
    title: 'Choose your direction',
    body: 'PUMP if you think price finishes above the strike. DUMP if below. RANGE if it stays inside the band. Your max loss is always your bet.',
    accent: '#22c55e',
    spotlightColor: 'rgba(34,197,94,0.12)',
    chips: [
      { label: 'PUMP', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
      { label: 'DUMP', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
      { label: 'RANGE', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    ],
  },
  {
    step: '03',
    title: 'Win or lose — instantly',
    body: 'When the market settles, the on-chain oracle records the price. Winners collect their USDC payout automatically — no claim needed.',
    accent: '#facc15',
    spotlightColor: 'rgba(234,179,8,0.10)',
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Non-custodial',
    body: 'Your USDC, your keys. Smart contracts handle every fill and settlement — no withdrawal requests, no KYC.',
    iconBg: 'rgba(34,197,94,0.10)',
  },
  {
    icon: Zap,
    title: 'Sub-second fills',
    body: "Bets execute on Base in ~2s. Gas is pinned to 80k so your wallet popup appears immediately, even on slow RPCs.",
    iconBg: 'rgba(250,204,21,0.10)',
  },
  {
    icon: BarChart2,
    title: 'Real-time odds',
    body: 'Implied probability and max multiplier are computed on-chain via simulatePayout — not a marketing estimate.',
    iconBg: 'rgba(96,165,250,0.10)',
  },
  {
    icon: Globe,
    title: 'Powered by Thetanuts V4',
    body: 'Polynuts is a front-end for Thetanuts Finance V4 structured-product vaults — audited, live since 2021.',
    iconBg: 'rgba(167,139,250,0.10)',
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0d14] text-white">

      {/* ── Minimal top nav ── */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 backdrop-blur-md">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-[#60a5fa]">poly</span>
          <span className="text-white">nuts</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/markets"
            className="flex items-center gap-2 rounded-full bg-[#60a5fa] px-5 py-2 text-sm font-semibold text-[#0a0d14] transition-all hover:bg-white hover:shadow-[0_0_24px_rgba(96,165,250,0.4)]"
          >
            Launch app <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pt-20 text-center"
      >
        <div className="absolute inset-0">
          <Aurora
            colorStops={['#1d4ed8', '#7c3aed', '#0ea5e9']}
            amplitude={1.2}
            blend={0.55}
            speed={0.8}
          />
        </div>
        {/* Vignette — fade hero into the rest of the page */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0d14]/40 via-transparent to-[#0a0d14]" />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Live on Base mainnet
          </div>

          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            <DecryptedText
              text="Trade the moment."
              speed={35}
              delay={200}
              className="block"
              encryptedClassName="text-white/20"
              animateOn="view"
            />
            <span className="mt-2 block bg-gradient-to-r from-[#22c55e] via-[#60a5fa] to-[#a855f7] bg-clip-text text-transparent">
              On-chain.
            </span>
          </h1>

          <p className="max-w-xl text-base text-white/50 sm:text-lg">
            Bet whether BTC or ETH will pump, dump, or range — in the next hour, day,
            or week. Fixed risk. Instant settlement. No custody.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/markets"
              className="group flex items-center gap-2 rounded-full bg-[#60a5fa] px-8 py-3.5 text-base font-semibold text-[#0a0d14] shadow-[0_0_32px_rgba(96,165,250,0.3)] transition-all hover:bg-white hover:shadow-[0_0_48px_rgba(96,165,250,0.5)]"
            >
              Start trading
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://thetanuts.finance"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-base font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Learn about V4 ↗
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {['PUMP', 'DUMP', 'RANGE'].map((d) => (
              <span
                key={d}
                className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${
                  d === 'PUMP'
                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                    : d === 'DUMP'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30 animate-bounce">
          <div className="h-8 w-[1px] bg-white/40" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">Scroll</span>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative border-y border-white/5 bg-white/[0.02] py-12 backdrop-blur-sm">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <div className="text-3xl font-bold tabular-nums text-white">
                <CountUp
                  to={s.value}
                  prefix={s.prefix ?? ''}
                  suffix={s.suffix ?? ''}
                  separator={s.separator ?? ','}
                  decimals={s.decimals}
                  duration={2}
                />
              </div>
              <div className="text-xs uppercase tracking-wide text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
              How it works
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Three steps to your first bet</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <SpotlightCard
                key={s.step}
                spotlightColor={s.spotlightColor}
                className="flex flex-col gap-5 p-7"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-4xl font-black tabular-nums"
                    style={{ color: s.accent + '80' }}
                  >
                    {s.step}
                  </span>
                  {s.chips && (
                    <div className="flex gap-1">
                      {s.chips.map((c) => (
                        <span
                          key={c.label}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.cls}`}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-base font-semibold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{s.body}</p>
                </div>
                <div
                  className="h-[1px] w-full rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${s.accent}40, transparent)`,
                  }}
                />
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature bento ── */}
      <section className="relative py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
              Why Polynuts
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Built different</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <SpotlightCard
                key={f.title}
                spotlightColor={f.iconBg}
                className="flex flex-col gap-4 p-6"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"
                  style={{ background: f.iconBg }}
                >
                  <f.icon className="h-5 w-5 text-white/70" />
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-white/45">{f.body}</p>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden py-32 px-6 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <div className="h-[600px] w-[600px] rounded-full bg-[#7c3aed] blur-[160px]" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <h2 className="mb-4 text-4xl font-black sm:text-5xl">Ready to trade?</h2>
          <p className="mb-10 text-lg text-white/50">
            243 live markets. Real money. On-chain settlement.
          </p>
          <Link
            href="/markets"
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] px-10 py-4 text-lg font-bold text-white shadow-[0_0_48px_rgba(34,197,94,0.3)] transition-all hover:scale-[1.03] hover:shadow-[0_0_64px_rgba(34,197,94,0.5)]"
          >
            Open the app
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-xs text-white/25">
          <span>
            <span className="text-[#60a5fa]">poly</span>nuts — Powered by Thetanuts V4
          </span>
          <div className="flex gap-6">
            <Link href="/markets" className="transition-colors hover:text-white/60">Markets</Link>
            <Link href="/leaderboard" className="transition-colors hover:text-white/60">Leaderboard</Link>
            <a
              href="https://thetanuts.finance"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white/60"
            >
              Thetanuts ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
