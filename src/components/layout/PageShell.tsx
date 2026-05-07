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
    <div className="min-h-screen bg-ink-50">
      <TopNav active={active} />
      <main className="mx-auto max-w-page px-6 py-6">{children}</main>
    </div>
  );
}
