import type { ReactNode } from 'react';
import { AdminLogoutButton } from './AdminLogoutButton';
import { ADMIN_ACCENT } from './theme';

export function AdminShell({
  children,
  authed = false,
}: {
  children: ReactNode;
  authed?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-[#0f131b] text-white antialiased">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0f131b]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-base font-extrabold tracking-tight">
              <span style={{ color: ADMIN_ACCENT }}>poly</span>
              <span className="text-white">nuts</span>
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              admin
            </span>
          </div>
          {authed && <AdminLogoutButton />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}

export function AdminNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] px-7 py-10 text-center">
      <h1 className="font-display text-lg font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
    </div>
  );
}
