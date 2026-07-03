import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

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

// Generous per-IP cap (tunable) — bounds a cache-busting flood of this open
// relay without throttling legit per-wallet polling.
const PROXY_RATE_LIMIT = 1_200;
const PROXY_RATE_WINDOW_MS = 60_000;

// Allowlist of the exact indexer subpaths the browser SDK reads through this
// relay. The ONLY caller is the browser client in src/lib/sdk/clients.ts
// (server-side sync in src/lib/supabase/sync.ts talks to the upstream directly,
// never through here). Anything else 404s so this can't be abused as an
// arbitrary-path relay to reach non-public upstream endpoints, as an
// IP-anonymising hop, or for DoS amplification. Evidence — the browser methods
// that route here (SDK V4 @thetanuts-finance/thetanuts-client):
//   getStatsFromIndexer()          -> /api/v1/book/stats
//   getBookDailyStats()            -> /api/v1/book/stats/daily
//   getUserPositionsFromIndexer()  -> /api/v1/book/user/{addr}/positions
//   getUserHistoryFromIndexer()    -> /api/v1/book/user/{addr}/history
const ADDR = '0x[0-9a-fA-F]{40}';
const ALLOWED_SUBPATHS: RegExp[] = [
  /^api\/v1\/book\/stats$/,
  /^api\/v1\/book\/stats\/daily$/,
  new RegExp(`^api/v1/book/user/${ADDR}/(positions|history)$`),
];

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const limited = enforceRateLimit(req, 'indexer', PROXY_RATE_LIMIT, PROXY_RATE_WINDOW_MS);
  if (limited) return limited;
  const { path } = await ctx.params;
  // The optional catch-all gives us whichever subpath the SDK used; only forward
  // it if it's a pinned, real SDK route (see ALLOWED_SUBPATHS).
  const subpath = path?.length ? path.join('/') : '';
  if (!ALLOWED_SUBPATHS.some((re) => re.test(subpath))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const url = `${UPSTREAM}/${subpath}${req.nextUrl.search}`;

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
    // Log the detail server-side; don't echo raw error text (which can carry
    // upstream URLs / internals) back to the client.
    console.error('[indexer proxy] upstream fetch failed', err);
    return NextResponse.json(
      { error: 'indexer upstream unreachable' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
