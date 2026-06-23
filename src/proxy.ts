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

/**
 * The pre-launch waitlist lives at the `/waitlist` route inside this same app,
 * but we serve it as the front door of a separate-looking host
 * (join.polynuts.xyz) while the real app stays at polynuts.xyz — one repo, one
 * Vercel project, no duplication. Requests on the `join.*` host are rewritten
 * to /waitlist so the app routes (markets, portfolio, …) aren't reachable
 * there; polynuts.xyz is untouched.
 *
 * Setup (one-time, outside the codebase): requires the custom domain first —
 * add `join.polynuts.xyz` in Vercel → Domains, then a CNAME `join` →
 * `cname.vercel-dns.com`. While the deployment is still on *.vercel.app this
 * rewrite stays dormant (no `join.*` host hits it); the page is reachable at
 * polynuts.vercel.app/waitlist directly.
 */
function isWaitlistHost(host: string | null): boolean {
  if (!host) return false;
  return host.split(':')[0].toLowerCase().startsWith('join.');
}

export function proxy(req: NextRequest) {
  // Next 16 removed `req.geo`; on Vercel the edge populates the
  // `x-vercel-ip-country` header from the same IP lookup. Locally and on
  // non-Vercel hosts the header is absent — country is '' and we let the
  // request through, matching the previous behaviour.
  //
  // Geo-block runs FIRST, so blocked countries hit /not-available even on the
  // waitlist host — consistent with the rest of the site.
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

  // Waitlist subdomain front door. Skip the route itself, API routes, and any
  // asset path (has a dot) so OG images / static files still resolve.
  if (isWaitlistHost(req.headers.get('host'))) {
    const { pathname } = req.nextUrl;
    const passthrough =
      pathname === '/waitlist' ||
      pathname.startsWith('/api') ||
      pathname.includes('.');
    if (!passthrough) {
      const url = req.nextUrl.clone();
      url.pathname = '/waitlist';
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}
