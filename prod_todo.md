# Polynuts — Production TODO (handoff)

**Handoff date:** 2026-06-14
**Branch:** `main` is now the trunk (default branch). PR #1 (`prod-readiness` → `main`, 46 commits) is **merged**.
**Goal:** deploy to Vercel and go live.

This is the live punch list for the next agent/person. It supersedes the "Production prep"
sections of `TODO.md`. Background detail lives in `production_checklist.md` and `brief.md`.

---

## State at handoff (don't redo these)

- ✅ Build gate green locally: `tsc --noEmit` 0 errors · `vitest` 90/90 · `next build --webpack` succeeds · `eslint` 0 errors, 8 warnings.
  - The 8 lint warnings are **intentional** React 19 / Next 16 rule warnings (hydration-guard `setState`-in-effect; `Date.now()` in `useMemo`). Verified not bugs. Do **not** refactor them pre-launch.
- ✅ `NEXT_PUBLIC_REFERRER_ADDRESS` — owner confirmed they have a real address. (Build throws on zero in prod via `src/lib/sdk/clients.ts:14`, so a green build already proves it's non-zero.)
- ✅ `main` established as trunk; GitHub default flipped from `prod-readiness` → `main`.

### Update — 2026-06-14 (env values captured locally)

All required env values now exist in `.env.local` — RPC (keyed Alchemy), referrer, WalletConnect,
Supabase URL/anon/service-role, and CRON_SECRET. **`.env.local` is gitignored and local-dev only —
it does NOT deploy.** Vercel never reads it.

So the remaining work is **not** "obtain these values" — it's mostly:
1. **Paste them into the Vercel project's env settings** (a copy job; values are ready).

(The DB-side migration + seed that env vars can't do is now **also done** — see P1, verified
2026-06-14 via the Supabase MCP against the live project the app points at.)

⚠️ `NEXT_PUBLIC_*` vars are **baked in at build time**, not read at runtime — they must be set in
Vercel *before* the production build, and any change requires a redeploy to take effect.

---

## What actually breaks vs. degrades (code-verified)

The **only** true money/correctness blocker was the referrer address (done). Everything below
**degrades gracefully — nothing else crashes the app or fails the build.** So a minimal deploy
runs and can place a bet. But "runs" ≠ "ready for users." Priority is by real-user impact.

| Env var | Code behavior if absent | Priority |
|---|---|---|
| `NEXT_PUBLIC_REFERRER_ADDRESS` | Build throws if zero (`clients.ts:14`) | ✅ DONE |
| `NEXT_PUBLIC_RPC_URL` | Falls back to **public** Base RPC (`wagmi.ts:14`, `clients.ts:8`, `supabase/sync.ts:18`). Works but rate-limits leaderboard event-scan + payout sims; live feed self-disables under load | **P0 for real traffic** |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Guarded by `hasSupabaseConfigClient` → leaderboard + trade-history show empty states, no crash. Core trading does not touch Supabase | P1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron returns 500; write-on-fill fails but is caught (non-critical) | P1 |
| `CRON_SECRET` | Cron is fail-closed — 401s everything (`route.ts:91`). No security hole; leaderboard just never auto-syncs | P1 |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WC connector **silently dropped** (`wagmi.ts:19`); MetaMask/Coinbase/Rainbow still connect. Mobile WC-QR users can't connect | P2 (cheap) |
| `NEXT_PUBLIC_CHAIN_ID` | Defaults to `8453` (Base) | ✅ default OK |
| `BLOCKED_COUNTRIES` | Defaults to `US` (server-only; never `NEXT_PUBLIC_`) | ✅ default OK |

---

## P0 — before real traffic

- [ ] **Vercel project setup:** import the repo, set **Production Branch = `main`**.
- [ ] **Push env vars to Vercel** — every value is ready in `.env.local`; this is a copy job. Set them all (don't paste only the ones you remember — the build throws on a zero `NEXT_PUBLIC_REFERRER_ADDRESS`, so referrer must be there too). Highest-impact one is **`NEXT_PUBLIC_RPC_URL`** (keyed Alchemy already in `.env.local`); without it prod falls back to the public Base RPC and rate-limits under any real load.

## P1 — leaderboard + persistence

- [ ] Add Supabase env to Vercel (values in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service-role is server-only).
- [x] ✅ **Migration applied + verified (2026-06-14, via Supabase MCP)** against the live project the app reads (`dgtmgtxoylpmzwzsacrr` = `NEXT_PUBLIC_SUPABASE_URL`). `0001_leaderboard` recorded; `traders`/`trades`/`settlements` exist with RLS **on**; only `public read` SELECT policies (no public write); `leaderboard_v` has `security_invoker=true` + anon/authenticated SELECT grant; **security advisors return 0 lints**.
- [x] ✅ **Seeded** — `traders` already holds 2 rows incl. the owner/referrer address `0xe6c3…e7ef` (plus a `0x…0001` test placeholder, harmless). First cron run has something to scan.
- [ ] **`CRON_SECRET`** — value already generated and in `.env.local`; add it to Vercel (server-only, no `NEXT_PUBLIC_`). Vercel Cron auto-sends it as `Authorization: Bearer <secret>`; route validates at `route.ts:90-94`. No code change. **Do not commit the value.**
- [ ] Confirm the cron shows active in the Vercel dashboard after deploy (`vercel.json` = `*/30 * * * *`).

## P2 — cheap wins

- [ ] **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** — value already in `.env.local`; just add it to Vercel. Without it, no WC-QR mobile connect (but app doesn't break).

## Pre-trust gates (run before pointing users at prod)

- [ ] **`node scripts/verify-sdk.mjs`** against the real RPC — pricing hard-gate (9 samples + 4 linearity assertions). Stop if any payout/multiplier is 0 or NaN. Also: `check-orders.mjs`, `check-markets.mjs`, `check-payouts.mjs`.
- [ ] **$1 mainnet smoke test** from the deployed URL (full 8-point list in `production_checklist.md` §6): connect → $1 PUMP bet → approve <1s → fill on Basescan → `/portfolio` updates ~1s → leaderboard renders → win-card OG image → WC QR on mobile.

---

## Explicitly OUT of v1 scope (do not build pre-launch)

Per `production_checklist.md` §8 and `TODO.md`:
- AA wallet path (Coinbase Smart Wallet / Safe `encodeFillOrder` branch) — defer until a real AA user reports breakage.
- Vanilla settlement-price slider — pure UI gap, no money risk.
- Iron condor markets — RANGER serves RANGE today.
- ENS resolution; fee dashboard (`getAllClaimableFees`); Sentry wire-up (deploy first, add before real users — `src/lib/sdk/logger.ts` already no-ops without it).
- Farcaster Frames, Telegram bot, copy trading, vaults — V2+.

## Optional cleanups (non-blocking)

- [ ] Delete the stale `prod-readiness` branch on the remote (confirmed still present 2026-06-14; no longer default, everything is in `main`). You are also still on `prod-readiness` locally — switch to `main` before cleanup.
- [ ] `useMarketData` hook is unused after the Deribit migration (`src/lib/sdk/useOrders.ts:43`) — delete or wire as a fallback. Audit "SHOULD FIX," low priority.

---

## TL;DR for the next agent

```
1. Vercel: import repo, Production Branch = main
2. Copy ALL env vars from .env.local into Vercel — values already exist:
   RPC (keyed) + referrer + Supabase x3 + CRON_SECRET + WalletConnect ID
   (NEXT_PUBLIC_* are build-time → set before build, redeploy to change)
3. ✅ DB DONE — migration applied, RLS verified, 2 traders seeded (Supabase MCP, 2026-06-14)
4. node scripts/verify-sdk.mjs   ← HARD GATE (run against the real RPC)
5. $1 mainnet bet from the deployed URL
6. Ship
```
