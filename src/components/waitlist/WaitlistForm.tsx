'use client';

import { useId, useState } from 'react';
import { ArrowRight, Check, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { hasSupabaseConfigClient } from '@/lib/supabase/browser';

const ACCENT = '#60a5fa';

// Pragmatic email shape check — not a full RFC validator. The DB has its own
// CHECK; this is just to give instant feedback before a round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Waitlist capture form. Submits to the server route /api/waitlist, which
 * validates + rate-limits and writes with the service role. This is a
 * write-only channel; the owner reads rows in the Supabase dashboard.
 *
 * Wallet is optional: connecting lets us allowlist / gate early access by
 * address at launch. `source` (?ref=) and `referrer` are captured so we can
 * see which channel (Twitter, Discord, …) actually converts.
 */
export function WaitlistForm() {
  const [configured] = useState(() => hasSupabaseConfigClient());
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Honeypot — real users never see or fill this; bots tend to fill every field.
  const [trap, setTrap] = useState('');

  const { address } = useAccount();
  const emailId = useId();

  const normalized = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(normalized);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valid || pending) return;

    // Honeypot tripped — pretend success, insert nothing.
    if (trap) {
      setDone(true);
      return;
    }

    // Channel attribution, read lazily at submit (no effect / CSR bailout):
    // ?ref=twitter (or utm_source) + document.referrer, so we can see which
    // channel actually converts.
    let source: string | null = null;
    let referrer: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('utm_source');
      source = ref ? ref.slice(0, 80) : null;
      referrer = document.referrer ? document.referrer.slice(0, 300) : null;
    } catch {
      // best-effort
    }

    setPending(true);
    try {
      // The server route validates, rate-limits, reads the UA from the request,
      // and upserts with the service role. A duplicate email silently no-ops
      // server-side, so a re-submit still resolves to success here.
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          wallet_address: address ?? null,
          source,
          referrer,
        }),
      });
      if (!res.ok) throw new Error(`waitlist responded ${res.status}`);
      setDone(true);
    } catch (err) {
      console.error('[waitlist] submit failed', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-white/40">
        Waitlist is warming up — check back shortly.
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: `${ACCENT}1a`, color: ACCENT }}
        >
          <Check className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-white">
            You&apos;re on the list.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">
            We&apos;ll email <span className="text-white/80">{normalized}</span>{' '}
            the moment early access opens.
            {address && (
              <>
                {' '}
                Your wallet{' '}
                <span className="font-mono text-white/70">
                  {shortAddr(address)}
                </span>{' '}
                is queued for allowlist.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3"
      noValidate
    >
      {/* Honeypot — off-screen, not announced, never tab-reachable. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company-website">Company website</label>
        <input
          id="company-website"
          name="company-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="you@email.com"
          aria-label="Email address"
          aria-invalid={!!error}
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3.5 text-base text-white placeholder:text-white/30 transition-colors focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40"
        />
        <button
          type="submit"
          disabled={!valid || pending}
          className="group press-scale flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[#131720] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {pending ? 'Joining…' : 'Join waitlist'}
          {!pending && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Optional wallet capture — RainbowKit, restyled to match the page. */}
      <ConnectButton.Custom>
        {({ account, openConnectModal, openAccountModal, mounted }) => {
          const connected = mounted && !!account;
          return (
            <button
              type="button"
              onClick={connected ? openAccountModal : openConnectModal}
              className="press-scale inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-medium text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
            >
              <Wallet className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              {connected ? (
                <>
                  Wallet linked ·{' '}
                  <span className="font-mono text-white/70">
                    {account.displayName}
                  </span>
                </>
              ) : (
                'Connect wallet for early access (optional)'
              )}
            </button>
          );
        }}
      </ConnectButton.Custom>

      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : (
        <p className="text-xs text-white/30">
          No spam. One email when we go live — that&apos;s it.
        </p>
      )}
    </form>
  );
}
