import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    // Run on every page navigation, but skip static assets, the not-available
    // page itself, the API routes, and Next.js internals.
    '/((?!_next/static|_next/image|favicon|api/health|not-available).*)',
  ],
};

/**
 * Comma-separated ISO country codes — e.g. "US,IR,KP,SY,CU,RU,BY".
 * Defaults to US-only blocking. Override with NEXT_PUBLIC_BLOCKED_COUNTRIES
 * (or BLOCKED_COUNTRIES, server-only) for additional jurisdictions.
 */
const blocked = new Set(
  (process.env.BLOCKED_COUNTRIES ?? process.env.NEXT_PUBLIC_BLOCKED_COUNTRIES ?? 'US')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

export function middleware(req: NextRequest) {
  // On Vercel, geo is populated automatically from edge region IP lookup.
  // Locally and on non-Vercel hosts, it is undefined — let the request through.
  const country = (req.geo?.country ?? '').toUpperCase();
  if (country && blocked.has(country)) {
    const url = req.nextUrl.clone();
    url.pathname = '/not-available';
    url.search = `?from=${encodeURIComponent(country)}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}
