import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

// Same-origin proxy for the Thetanuts MM offchain order book (the "Odette"
// worker). The SDK's `client.api` (fetchOrders / getMarketData) fetches this
// from the BROWSER, but the upstream worker CORS-allowlists only specific
// origins (localhost + the Thetanuts app) — it returns no
// `Access-Control-Allow-Origin` for ours, so a direct browser fetch is blocked
// on every deployed domain. Routing through our own origin removes CORS
// entirely (same-origin request) and means we never maintain a per-domain
// allowlist on the worker as we add polynuts.xyz / Vercel preview URLs. CORS is
// a browser-only check; this server→worker hop isn't subject to it.
const UPSTREAM = 'https://round-snowflake-9c31.devops-118.workers.dev';

// The order book is shared, public, read-only data polled by every client
// (orders ~30s, prices ~5s). A short CDN cache collapses a burst of concurrent
// user polls into one upstream fetch, shielding the worker, while
// stale-while-revalidate keeps responses instant. Kept to a few seconds so
// pre-signed orders can't go stale enough to cause avoidable fill reverts —
// fills are validated on-chain anyway.
const CACHE = 'public, s-maxage=3, stale-while-revalidate=10';

const UPSTREAM_TIMEOUT_MS = 15_000;

// Generous per-IP cap (tunable). Bounds a cache-busting flood of this open
// relay without throttling legit polling, which is mostly served from the CDN
// cache above and never invokes this function. Scheme+host are hardcoded so this
// can't be repointed at another host, and the subpath is pinned to the SDK's
// real routes by ALLOWED_SUBPATHS below.
const PROXY_RATE_LIMIT = 1_200;
const PROXY_RATE_WINDOW_MS = 60_000;

// Allowlist of the exact order-book subpaths the browser SDK reads through this
// relay. The only caller is the browser client in src/lib/sdk/clients.ts;
// anything else 404s so this can't be used as an arbitrary-path relay / IP hop.
// Evidence (SDK V4 @thetanuts-finance/thetanuts-client, `api` module):
//   fetchOrders() / getMarketData()  -> request("/")       (worker root)
//   filterOrders()                   -> request("/orders")
const ALLOWED_SUBPATHS = new Set(['', 'orders']);

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const limited = enforceRateLimit(req, 'orderbook', PROXY_RATE_LIMIT, PROXY_RATE_WINDOW_MS);
  if (limited) return limited;
  const { path } = await ctx.params;
  // The optional catch-all preserves whichever subpath the SDK used; only
  // forward pinned, real SDK routes (see ALLOWED_SUBPATHS).
  const subpath = path?.length ? path.join('/') : '';
  if (!ALLOWED_SUBPATHS.has(subpath)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const suffix = subpath ? `/${subpath}` : '/';
  const url = `${UPSTREAM}${suffix}${req.nextUrl.search}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    // Forward only content-type — no cookies/auth headers. This is public data
    // and we don't want to leak request headers to a third-party worker.
    const upstream = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
    });
    const body = await upstream.text();
    const res = new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
    // Only cache successful responses; let errors retry immediately.
    if (upstream.ok) res.headers.set('Cache-Control', CACHE);
    return res;
  } catch (err) {
    // Log the detail server-side; don't echo raw error text (which can carry
    // upstream URLs / internals) back to the client.
    console.error('[orderbook proxy] upstream fetch failed', err);
    return NextResponse.json(
      { error: 'order book upstream unreachable' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
