import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    // Run on every page navigation, but skip static assets, the not-available
    // page itself, the API routes, and Next.js internals.
    '/((?!_next/static|_next/image|favicon|api/health|not-available).*)',
  ],
};

/**
 * Comma-separated ISO country codes to geo-block — e.g. "IR,KP,SY,CU".
 * Empty/unset means no country is blocked (open to all regions, including the
 * US). Set BLOCKED_COUNTRIES in server env to restrict specific regions.
 *
 * Read per-request (not a module const) so it's trivially testable and reflects
 * env without a rebuild — same pattern as isPrelaunch() below. Never use
 * NEXT_PUBLIC_ here — this list runs server/edge only and should not be
 * embedded in the client bundle.
 */
function blockedCountries(): Set<string> {
  return new Set(
    (process.env.BLOCKED_COUNTRIES ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

// ─── Pre-launch ("coming soon") gate ────────────────────────────────────────
// While LAUNCH_MODE is on, every visitor is funneled to /waitlist and the rest
// of the site (landing + app) stays hidden. Flip LAUNCH_MODE off (or unset) and
// redeploy to open everything on launch day. Read per-request (not a module
// const) so it's trivially testable and reflects env without code changes.
//
// The owner can still preview the real, locked site: hitting any URL with
// `?preview=<LAUNCH_PREVIEW_SECRET>` sets an httpOnly bypass cookie (and strips
// the secret from the URL). /admin is always reachable regardless — it has its
// own password gate.
const PREVIEW_COOKIE = 'pn_preview';
const PRELAUNCH_VALUES = new Set(['waitlist', 'prelaunch', 'coming-soon', '1', 'true', 'on']);

function isPrelaunch(): boolean {
  return PRELAUNCH_VALUES.has((process.env.LAUNCH_MODE ?? '').trim().toLowerCase());
}

function previewSecret(): string {
  return process.env.LAUNCH_PREVIEW_SECRET ?? '';
}

/** Constant-time-ish string compare (edge runtime — no node:crypto here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hasPreviewBypass(req: NextRequest): boolean {
  const secret = previewSecret();
  if (!secret) return false;
  const cookie = req.cookies.get(PREVIEW_COOKIE)?.value;
  return !!cookie && safeEqual(cookie, secret);
}

/** Paths that stay reachable even while the coming-soon gate is up. */
function allowedDuringPrelaunch(pathname: string): boolean {
  return (
    pathname === '/waitlist' ||
    pathname.startsWith('/admin') || // own password gate; owner needs it pre-launch
    pathname.startsWith('/api') || // waitlist/feedback/admin endpoints + OG images
    pathname === '/not-available' ||
    pathname.includes('.') // static asset (has an extension)
  );
}

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
  if (country && blockedCountries().has(country)) {
    // Redirect (307) to /not-available so the URL bar reflects the block and
    // crawlers / compliance audits see a distinct route, not a 200 with the
    // home page rendered behind a rewrite. /not-available is excluded from
    // the matcher above so the redirect terminates there.
    const url = req.nextUrl.clone();
    url.pathname = '/not-available';
    url.search = `?from=${encodeURIComponent(country)}`;
    return NextResponse.redirect(url, { status: 307 });
  }

  // Pre-launch gate. Only relevant while LAUNCH_MODE is on.
  if (isPrelaunch()) {
    // `?preview=<secret>` toggles the owner bypass cookie, then redirects to a
    // clean URL so the secret never lingers in history/logs.
    const preview = req.nextUrl.searchParams.get('preview');
    if (preview !== null) {
      const url = req.nextUrl.clone();
      url.searchParams.delete('preview');
      const res = NextResponse.redirect(url);
      const secret = previewSecret();
      if (secret && safeEqual(preview, secret)) {
        res.cookies.set(PREVIEW_COOKIE, preview, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });
      } else {
        res.cookies.set(PREVIEW_COOKIE, '', { path: '/', maxAge: 0 });
      }
      return res;
    }

    // Everyone without a valid bypass cookie sees the waitlist (except the
    // always-allowed paths above).
    if (!hasPreviewBypass(req) && !allowedDuringPrelaunch(req.nextUrl.pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/waitlist';
      url.search = '';
      return NextResponse.rewrite(url);
    }
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
