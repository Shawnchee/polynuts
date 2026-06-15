import { NextResponse, type NextRequest } from 'next/server';

// Same-origin proxy for the Thetanuts indexer (a.k.a. state/book API). The SDK
// reads user positions/history (`*FromIndexer`) and protocol/daily stats
// (`*FromRfq` / book stats) from the BROWSER, but the upstream indexer
// CORS-allowlists only specific origins (localhost + the Thetanuts app) — it
// returns no `Access-Control-Allow-Origin` for ours, so a direct browser fetch
// is blocked on every deployed domain (polynuts.xyz, *.vercel.app). Routing
// through our own origin removes CORS entirely (same-origin request) and means
// we never have to get added to a per-domain allowlist on the indexer. CORS is
// a browser-only check; this server→indexer hop isn't subject to it.
//
// Server-side callers (src/lib/supabase/sync.ts via getSyncClient) talk to the
// indexer directly with the absolute upstream URL and don't go through here.
// Only the browser clients in src/lib/sdk/clients.ts point at /api/indexer.
const UPSTREAM = 'https://indexer.thetanuts.finance';

// Daily/protocol stats are shared, public, read-only data polled by every
// visitor (the landing page + leaderboard) — a short CDN cache collapses a
// burst of concurrent polls into one upstream fetch. Per-user positions/history
// are per-wallet (low fan-out) and feed live open-position PnL on the activity
// page, so we keep those uncached to avoid showing stale PnL.
const SHARED_CACHE = 'public, s-maxage=3, stale-while-revalidate=10';

const UPSTREAM_TIMEOUT_MS = 15_000;

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  // The SDK builds absolute browser URLs like
  //   {origin}/api/indexer/api/v1/book/stats/daily   (stateApiUrl)
  //   {origin}/api/indexer/api/v1/book/user/0x.../history  (indexerApiUrl)
  // The optional catch-all gives us whichever subpath the SDK used; forward it
  // verbatim to the upstream indexer at the same path.
  const suffix = path?.length ? `/${path.join('/')}` : '/';
  const url = `${UPSTREAM}${suffix}${req.nextUrl.search}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    // Forward only content-type — no cookies/auth headers. This is public data
    // and we don't want to leak request headers to a third party.
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
    // Only cache successful, shared (non-per-user) responses.
    if (upstream.ok && !path?.includes('user')) {
      res.headers.set('Cache-Control', SHARED_CACHE);
    }
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: 'indexer upstream unreachable', detail: String(err) },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
