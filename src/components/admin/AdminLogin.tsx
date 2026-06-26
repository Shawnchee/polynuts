'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { ADMIN_ACCENT } from './theme';

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // The RSC re-reads the cookie and swaps in the dashboard.
        router.refresh();
        return;
      }
      if (res.status === 429) setError('Too many attempts — wait a minute and try again.');
      else setError('Incorrect password.');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-7 py-8">
        <div
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ADMIN_ACCENT}1a`, color: ADMIN_ACCENT }}
        >
          <Lock className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="font-display text-lg font-bold text-white">Admin access</h1>
        <p className="mt-1 text-sm text-white/45">Enter the admin password to continue.</p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="group inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#0f131b] transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: ADMIN_ACCENT }}
          >
            {busy ? 'Checking…' : 'Unlock'}
            {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
