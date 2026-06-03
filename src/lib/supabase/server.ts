import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseConfig(): boolean {
  return !!URL && !!ANON;
}

/**
 * Cookie-aware server client for RSC / route handlers. Reads go through
 * this; honors RLS as the anonymous role.
 */
export function getSupabaseServer() {
  if (!URL || !ANON) {
    throw new Error('Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }
  const cookieStore = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // RSC contexts can't set cookies; safe to swallow.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // see above
        }
      },
    },
  });
}

/**
 * Service-role client. NEVER import this from client components or files
 * under `src/app/*` that aren't route handlers — it bypasses RLS.
 */
export function getSupabaseService(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error('Supabase service-role env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
