import type { ReactNode } from 'react';
import { TopNav } from '@/components/nav/TopNav';
import { NetworkGuard } from '@/components/nav/NetworkGuard';

export function PageShell({
  active,
  children,
}: {
  active: '/' | '/portfolio' | '/leaderboard' | '/activity' | '/profile';
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh scroll-pt-20">
      <TopNav active={active} />
      <NetworkGuard />
      <main className="mx-auto w-full max-w-page px-4 py-6 sm:px-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
