import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin/auth';
import { getSupabaseService, hasSupabaseConfig } from '@/lib/supabase/server';
import { loadAdminData } from '@/lib/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// JSON feed for the admin dashboard's in-page refresh button. Same data the
// /admin RSC renders on first paint, behind the same session-cookie gate.
export async function GET() {
  const jar = await cookies();
  if (!verifyAdminToken(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 503 });
  }

  const data = await loadAdminData(getSupabaseService());
  return NextResponse.json(data);
}
