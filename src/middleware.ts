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
 * Defaults to US-only blocking. Set BLOCKED_COUNTRIES in server env to override.
 * Never use NEXT_PUBLIC_ here — this list runs server/edge only and should
 * not be embedded in the client bundle.
 */
const blocked = new Set(
  (process.env.BLOCKED_COUNTRIES ?? 'US')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

export function middleware(req: NextRequest) {
  // Next 16 removed `req.geo`; on Vercel the edge populates the
  // `x-vercel-ip-country` header from the same IP lookup. Locally and on
  // non-Vercel hosts the header is absent — country is '' and we let the
  // request through, matching the previous behaviour.
  const country = (req.headers.get('x-vercel-ip-country') ?? '').toUpperCase();
  if (country && blocked.has(country)) {
    // Redirect (307) to /not-available so the URL bar reflects the block and
    // crawlers / compliance audits see a distinct route, not a 200 with the
    // home page rendered behind a rewrite. /not-available is excluded from
    // the matcher above so the redirect terminates there.
    const url = req.nextUrl.clone();
    url.pathname = '/not-available';
    url.search = `?from=${encodeURIComponent(country)}`;
    return NextResponse.redirect(url, { status: 307 });
  }
  return NextResponse.next();
}
