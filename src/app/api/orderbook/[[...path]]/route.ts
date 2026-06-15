import { NextResponse, type NextRequest } from 'next/server';

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  // fetchOrders / getMarketData hit the worker root ("/"); filterOrders hits
  // "/orders". The optional catch-all preserves whichever subpath the SDK used.
  const suffix = path?.length ? `/${path.join('/')}` : '/';
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
    return NextResponse.json(
      { error: 'order book upstream unreachable', detail: String(err) },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
