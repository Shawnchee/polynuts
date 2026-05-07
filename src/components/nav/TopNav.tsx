'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useUsdcBalance } from '@/lib/sdk/useUsdcBalance';
import { ThemeToggle } from '@/components/nav/ThemeToggle';
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
    <header className="sticky top-0 z-30 glass border-b border-line">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="select-none text-md font-bold tracking-tight transition-opacity hover:opacity-90"
          >
            <span className="text-brand">poly</span>
            <span className="text-text">nuts</span>
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => {
              const isActive = active === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    'relative rounded-md px-3 py-1.5 text-base transition-colors duration-180',
                    isActive
                      ? 'font-semibold text-text bg-surface'
                      : 'font-medium text-text-muted hover:text-text hover:bg-surface-hover'
                  )}
                >
                  {t.label}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-brand"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && bal && (
            <div className="hidden items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 sm:flex">
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
