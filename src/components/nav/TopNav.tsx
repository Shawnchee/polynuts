'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MessageSquarePlus } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUsdcBalance } from '@/lib/sdk/useUsdcBalance';
import { ThemeToggle } from '@/components/nav/ThemeToggle';
import { ChainStatusChip } from '@/components/nav/NetworkGuard';
import { hasSupabaseConfigClient } from '@/lib/supabase/browser';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/markets', label: 'Markets' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function TopNav({ active = '/' }: { active?: string }) {
  const { isConnected } = useAccount();
  const { data: bal } = useUsdcBalance();
  const setFeedbackOpen = useAppStore((s) => s.setFeedbackOpen);
  const feedbackReady = hasSupabaseConfigClient();

  return (
    <header className="sticky top-0 z-30 glass border-b border-line">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/"
            aria-label="Polynuts home"
            className="font-display flex cursor-pointer select-none items-center text-md font-bold tracking-tight transition-opacity hover:opacity-90"
          >
            <span className="text-brand">poly</span>
            <span className="text-text">nuts</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {tabs.map((t) => {
              const isActive = active === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative flex cursor-pointer items-center rounded-md px-3 py-2 text-base transition-colors duration-180',
                    isActive
                      ? 'font-semibold text-text bg-surface'
                      : 'font-medium text-text-muted hover:text-text hover:bg-surface-hover'
                  )}
                >
                  {t.label}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-brand"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ChainStatusChip />
          {feedbackReady && (
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              aria-haspopup="dialog"
              aria-label="Send feedback"
              className="press-scale inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-text sm:hidden"
            >
              <MessageSquarePlus className="h-4 w-4 text-brand" aria-hidden="true" />
            </button>
          )}
          {isConnected && bal && (
            <div className="hidden items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 lg:flex">
              <span className="label text-text-dim">USDC</span>
              <span className="num text-sm font-semibold text-text">
                {Number(bal.formatted).toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          <ThemeToggle />
          <ConnectButton
            chainStatus="icon"
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
            showBalance={false}
          />
        </div>
      </div>
    </header>
  );
}
