import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PixelIcon } from '@/components/landing/PixelIcon';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';

const ACCENT = '#60a5fa';

/**
 * Self-contained hero backdrop — a faint accent glow over a hairline grid,
 * masked so it dissolves toward the edges and never competes with the copy.
 * Kept inline (pure CSS, no canvas) so this page has no dependency on the
 * marketing landing's components.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 60%)` }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 30% 30%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 30% 30%, black, transparent 75%)',
        }}
      />
    </div>
  );
}

/**
 * A product screenshot framed as a browser window — top chrome with traffic
 * lights + a faux URL, the shot, then a caption. Screenshots are 2560×1600
 * (dark-mode app captures); next/image scales + lazy-loads them.
 */
function BrowserFrame({
  src,
  alt,
  url,
  caption,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  url: string;
  caption: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 truncate font-mono text-[11px] text-white/30">{url}</span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={2560}
        height={1600}
        priority={priority}
        sizes={sizes}
        className="h-auto w-full"
      />
      <figcaption className="border-t border-white/[0.06] px-4 py-3 font-mono text-xs text-white/40">
        {caption}
      </figcaption>
    </figure>
  );
}

export const metadata: Metadata = {
  title: 'Join the waitlist',
  description:
    'The Polymarket of crypto options. Bet PUMP or DUMP on ETH & BTC, on-chain. Join the Polynuts waitlist for early access.',
  // Live host today is polynuts.vercel.app; swap these to
  // https://join.polynuts.xyz once the custom domain is added.
  alternates: { canonical: 'https://polynuts.vercel.app/waitlist' },
  openGraph: {
    title: 'Polynuts — the Polymarket of crypto options',
    description: 'Bet PUMP or DUMP on ETH & BTC, on-chain. Join the waitlist for early access.',
    url: 'https://polynuts.vercel.app/waitlist',
  },
  // Pre-launch capture page — keep it out of the index.
  robots: { index: false, follow: false },
};

const PERKS = [
  {
    icon: 'bolt',
    title: 'Early access',
    body: 'Skip the line when we open the doors. Waitlist first, public second.',
  },
  {
    icon: 'lock',
    title: 'Founding allowlist',
    body: 'Link a wallet and you’re queued for early-access allowlisting at launch.',
  },
  {
    icon: 'settle',
    title: 'First to know',
    body: 'One email the moment markets go live. No drip, no noise.',
  },
] as const;

export default function WaitlistPage() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-[#131720] text-white antialiased">
      {/* ── Top bar — wordmark only; no app links on the pre-launch front door ── */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#131720]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            <span style={{ color: ACCENT }}>poly</span>
            <span className="text-white">nuts</span>
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: ACCENT }} />
            Coming soon
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden px-6 pb-20 pt-28">
        <Backdrop />

        <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Copy + form — left-aligned, asymmetric (no centered-everything). */}
          <div className="flex flex-col items-start gap-7 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              The Polymarket of crypto options
            </div>

            <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
              Bet the moment.
              <span className="mt-1 block" style={{ color: ACCENT }}>
                Get in early.
              </span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
              Like Polymarket — but for options. Bet whether BTC or ETH will
              pump, dump, or range: fixed risk, instant on-chain settlement, no
              custody. Join the waitlist and we&apos;ll email you the second
              it&apos;s live.
            </p>

            <div id="join" className="w-full max-w-md scroll-mt-28">
              <WaitlistForm />
            </div>
          </div>

          {/* Perks rail — echoes the landing's hairline-divided card system. */}
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.07]">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-4 bg-[#131720] p-6">
                <PixelIcon name={p.icon} className="mt-0.5 h-7 w-7 shrink-0" style={{ color: ACCENT }} />
                <div>
                  <h3 className="font-display text-base font-bold text-white">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/45">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Teaser: a peek inside the live product ── */}
      <section className="relative border-t border-white/[0.06] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
              A peek inside
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              The product is built.
              <br />
              You&apos;re early to the door.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/50">
              Real markets, real on-chain settlement — running on Base right now.
              The waitlist just gets you in first.
            </p>
          </div>

          {/* Featured shot — the markets surface. */}
          <BrowserFrame
            src="/teasers/markets.png"
            alt="Polynuts markets page — a grid of live BTC and ETH options with real-time odds and a live on-chain fills feed"
            url="polynuts.xyz/markets"
            caption="Live markets — 240+ BTC & ETH options, real-time odds, on-chain fills"
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
          />

          {/* Two-up — the bet ticket + the leaderboard. */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <BrowserFrame
              src="/teasers/trade.png"
              alt="Polynuts bet ticket — choose a stake and see your exact USDC payout and implied probability"
              url="polynuts.xyz/markets"
              caption="One-tap bets — pick a stake, see your exact payout"
              sizes="(max-width: 640px) 100vw, 512px"
            />
            <BrowserFrame
              src="/teasers/leaderboard.png"
              alt="Polynuts leaderboard — recent trades and per-trader rankings by realized PnL"
              url="polynuts.xyz/leaderboard"
              caption="On-chain leaderboard — every fill, ranked by PnL"
              sizes="(max-width: 640px) 100vw, 512px"
            />
          </div>

          {/* Closing CTA back up to the form. */}
          <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl font-bold text-white">
              Want in before everyone else?
            </p>
            <a
              href="#join"
              className="group press-scale inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[#131720] transition-all hover:brightness-110"
              style={{ background: ACCENT }}
            >
              Join the waitlist
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-xs text-white/30">
          <span className="font-mono">
            <span style={{ color: ACCENT }}>poly</span>nuts — powered by Thetanuts V4
          </span>
          <a
            href="https://thetanuts.finance"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-mono transition-colors hover:text-white/70"
          >
            Thetanuts <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
