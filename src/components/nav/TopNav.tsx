'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useUsdcBalance } from '@/lib/sdk/useUsdcBalance';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', label: 'Markets' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/activity', label: 'Activity' },
];

export function TopNav({ active = '/' }: { active?: string }) {
  const { isConnected } = useAccount();
  const { data: bal } = useUsdcBalance();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="select-none text-md font-bold tracking-tight">
            <span className="text-brand">poly</span>
            <span className="text-ink-900">nuts</span>
          </Link>
          <nav className="flex items-center gap-6">
            {tabs.map((t) => {
              const isActive = active === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    'relative pb-3.5 pt-3.5 text-base transition-colors',
                    isActive
                      ? 'font-semibold text-ink-900'
                      : 'font-medium text-ink-600 hover:text-ink-900'
                  )}
                >
                  {t.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-ink-900" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && bal && (
            <div className="hidden items-center gap-2 rounded-md border border-ink-200 px-3 py-1.5 sm:flex">
              <span className="label text-ink-400">USDC</span>
              <span className="num text-sm font-semibold text-ink-900">
                {Number(bal.formatted).toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
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
