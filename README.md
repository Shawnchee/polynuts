# Polynuts

A non-custodial **prediction market for crypto price direction** on Base mainnet. Bet whether BTC or ETH will **PUMP** (close above a strike), **DUMP** (close below), or **RANGE** (stay within a band) over a fixed window — today, tomorrow, or next week. Max loss is your bet; settlement is automatic and trustless.

Polynuts is a frontend and referrer/aggregator over [Thetanuts V4](https://thetanuts.finance) options vaults: orders are maker-signed, payout math is computed on-chain, and settlement uses the Deribit index price. Polynuts never takes custody — it earns the protocol's built-in referrer fee on each fill (the taker pays only the premium; there is no extra platform fee).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · wagmi v2 / viem / RainbowKit · ethers v6 · React Query · Zustand · Supabase (Postgres + RLS) · `@thetanuts-finance/thetanuts-client` · deployed on Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in values (see Environment)
npm run dev                  # http://localhost:3000
```

It runs against Base mainnet on the public RPC out of the box, but you'll want a real RPC key for anything past browsing (the public endpoint rate-limits hard).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (run once) |
| `npm run test:watch` | Vitest watch mode |

## Environment

Copy `.env.example` → `.env.local`; it has the full annotated list. The essentials:

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | yes | `8453` (Base mainnet). |
| `NEXT_PUBLIC_RPC_URL` | yes | Base JSON-RPC. Public default rate-limits hard — use Alchemy/QuickNode/Infura. **Browser-exposed**, so use a domain-restricted key. |
| `NEXT_PUBLIC_REFERRER_ADDRESS` | **in prod** | Fee-earning address. `next build` throws in production if it's missing or the zero address, so a fee-leaking deploy can't ship. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | Enables mobile wallets via WalletConnect QR. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | optional | Enables the persisted leaderboard + activity. Without them the app reads trade history straight from the indexer. **Never** expose the service-role key to the browser — it bypasses RLS. |
| `CRON_SECRET` | optional | Bearer auth for `/api/cron/sync-leaderboard`. |
| `BLOCKED_COUNTRIES` | optional | Comma-separated ISO codes for the geo-block (`src/proxy.ts`). **Server-only — no `NEXT_PUBLIC_` prefix.** Defaults to `US`. Reads Vercel's `x-vercel-ip-country`, so it only enforces on Vercel. |

## Architecture

```
Browser ── Next.js 16 App Router ── Base mainnet (Thetanuts V4 OptionBook)
   │  pages: / /markets /portfolio /leaderboard /activity
   │  wallets: RainbowKit + wagmi (MetaMask, Coinbase, Rainbow, WalletConnect)
   │  SDK: @thetanuts-finance/thetanuts-client
   │
   ├── /api/orderbook/*  → same-origin proxy to the MM order-book worker
   ├── /api/indexer/*    → same-origin proxy to indexer.thetanuts.finance
   ├── /api/me/trades    → write-on-fill + read (verifies fills on-chain)
   └── /api/cron/sync-leaderboard → optional recovery + settlement sync
        │
        └── Supabase (Postgres + RLS): trades · settlements · leaderboard view
```

### Same-origin API proxies

The Thetanuts order-book worker and the indexer CORS-allowlist only specific origins (localhost + the Thetanuts app), so the browser can't call them directly from a deployed domain — it works locally but is blocked on `polynuts.xyz` / Vercel. The app routes those browser reads through same-origin Next route handlers instead:

- `/api/orderbook/*` → the MM "Odette" order-book worker (orders, market data)
- `/api/indexer/*` → `indexer.thetanuts.finance` (user positions/history, protocol & daily stats)

The browser SDK clients in `src/lib/sdk/clients.ts` point at these proxies. Server-side code (settlement sync, fill verification) talks to the upstreams directly — server→server requests aren't subject to CORS.

### Trade history & leaderboard

Trades enter the DB only via `POST /api/me/trades`, called right after a fill confirms. The route:

1. Verifies the tx on-chain — the transaction sender **and** the `OrderFilled` event's taker/option must match the claim.
2. Derives the economic fields (contracts / price / notional) from the on-chain event; the client's numbers are kept for optimistic UI but never trusted for what's stored, so nobody can record fake trades or inflate leaderboard volume for a wallet they don't control.

In v1, settlements also sync when a user visits their portfolio/activity. `/api/cron/sync-leaderboard` is an optional cron (recovers missed fills, refreshes settlements for inactive wallets) — it exists but is **not scheduled** by default (`vercel.json` defines no cron); enable it by adding a schedule and setting `CRON_SECRET`.

## Security

- **Content-Security-Policy** — ships in **report-only** mode (`next.config.mjs`). Promote to enforcing after confirming zero violations on the deployed site; switch the inline-script allowance to a per-request nonce (via `src/proxy.ts`) before flipping.
- **Geo-block** — `src/proxy.ts` redirects blocked countries to `/not-available`. Enforces only on Vercel (uses `x-vercel-ip-country`); see `BLOCKED_COUNTRIES`.
- **On-chain trade verification** — see above; the write path can't be spoofed.
- **Supabase RLS** — the anon role is read-only; every write goes through the server with the service-role key.

## Deployment (Vercel)

- Set the env vars in project settings, not just `.env.local`. `NEXT_PUBLIC_REFERRER_ADDRESS` must be a real fee-earning address or the production build fails by design.
- Browser-exposed keys (`NEXT_PUBLIC_RPC_URL`, WalletConnect ID) should be domain-restricted.
- If you enable the leaderboard cron, add a schedule (e.g. in `vercel.json`) and set `CRON_SECRET`.
