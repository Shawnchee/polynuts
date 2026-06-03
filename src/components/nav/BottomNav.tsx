'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Wallet, Trophy, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', label: 'Markets', Icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', Icon: Wallet },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  { href: '/activity', label: 'Activity', Icon: Activity },
];

// Mobile-only bottom tab bar. The inline nav in TopNav overflowed a 375px
// viewport, so it's hidden below sm and this becomes the primary navigation on
// phones; hidden at sm+ where the inline nav takes over. Self-resolves the
// active route via usePathname so no prop threading is needed.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="mx-auto flex max-w-page items-stretch justify-around">
        {tabs.map(({ href, label, Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors duration-180',
                isActive ? 'text-brand' : 'text-text-muted hover:text-text'
              )}
            >
              <Icon
                className="h-5 w-5"
                aria-hidden
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
