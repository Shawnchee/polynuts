import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminConfigured, verifyAdminToken } from '@/lib/admin/auth';
import { getSupabaseService, hasSupabaseConfig } from '@/lib/supabase/server';
import { loadAdminData } from '@/lib/admin/queries';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminShell, AdminNotice } from '@/components/admin/AdminShell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Keep the internal console out of search indexes regardless of robots.txt.
export const metadata: Metadata = {
  title: 'Polynuts Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // No password configured → the whole feature is dormant. Say so plainly
  // instead of showing a login that can never succeed.
  if (!isAdminConfigured()) {
    return (
      <AdminShell>
        <AdminNotice
          title="Admin is not configured"
          body="Set ADMIN_PASSWORD in the environment to enable the dashboard, then reload this page."
        />
      </AdminShell>
    );
  }

  const jar = await cookies();
  const authed = verifyAdminToken(jar.get(ADMIN_COOKIE)?.value);
  if (!authed) {
    return (
      <AdminShell>
        <AdminLogin />
      </AdminShell>
    );
  }

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <AdminShell authed>
        <AdminNotice
          title="Supabase is not configured"
          body="Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to read waitlist, trades and feedback."
        />
      </AdminShell>
    );
  }

  const data = await loadAdminData(getSupabaseService());
  return (
    <AdminShell authed>
      <AdminDashboard initial={data} />
    </AdminShell>
  );
}
