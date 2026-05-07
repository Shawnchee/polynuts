import type { ReactNode } from 'react';
import { TopNav } from '@/components/nav/TopNav';

export function PageShell({
  active,
  children,
}: {
  active: '/' | '/portfolio' | '/leaderboard' | '/activity' | '/profile';
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <TopNav active={active} />
      <main className="mx-auto max-w-page px-6 py-6 animate-fade-in">{children}</main>
    </div>
  );
}
