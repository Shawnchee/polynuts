# Polynuts — Production TODO (handoff)

**Handoff date:** 2026-06-14
**Branch:** `main` is now the trunk (default branch). PR #1 (`prod-readiness` → `main`, 46 commits) is **merged**.
**Goal:** deploy to Vercel and go live.

This is the live punch list for the next agent/person. It supersedes the "Production prep"
sections of `TODO.md`. Background detail lives in `brief.md`. (The older `production_checklist.md`
was folded into this file and removed — it had a stale cron section that contradicted the v1 decision.)

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

### Update — 2026-06-15 (verify-sdk passed; **leaderboard cron dropped from v1**)

- ✅ `node scripts/verify-sdk.mjs` **PASS** — 9 samples (butterfly/spread/ranger) + 4 bet sizes; multipliers/payouts/implied-prob all valid; linearity drift <0.01%. (Skips vanilla PUMP/DUMP by design — that path is covered by the $1 smoke test.)
- ⚠️ **The Alchemy key in `.env.local` is FREE tier.** Free tier caps `eth_getLogs` to a 10-block range; the cron's fill-recovery scans 3000 blocks → the whole pass 500s. Same key in Vercel ⇒ same failure in prod. Trading + `/portfolio` are unaffected (indexer + `eth_call`, no getLogs).
- ✅ **Decision: drop the leaderboard cron from v1.** It is NOT load-bearing — settlements are also written on-demand by `GET /api/me/trades` → `syncSettlementsOnly` (indexer + DB, no getLogs) every time a trader views their portfolio (`useTradeHistoryDb.ts:44`). The cron only added (a) settling absent traders who never return, and (b) the getLogs recovery net. **Accepted v1 gap:** an absent winner's leaderboard PnL lags until they revisit; self-heals on their next visit.
- Done in this pass: `crons` removed from `vercel.json` (now `{}`); `CRON_SECRET` removed from `.env.local` and the env list. **Cron route file kept** (just unscheduled) so it's trivial to re-enable on a paid RPC later — add a Job-1 `try/catch` then so a getLogs hiccup can't take down the settlement sync.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only writes fail (caught). Needed by `/api/me/trades` write-on-fill + on-visit settlement sync | P1 |
| `CRON_SECRET` | **Cron dropped from v1** (2026-06-15 update) — not needed. Settlements sync via `GET /api/me/trades` on portfolio visit | ✅ N/A in v1 |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WC connector **silently dropped** (`wagmi.ts:19`); MetaMask/Coinbase/Rainbow still connect. Mobile WC-QR users can't connect | P2 (cheap) |
| `NEXT_PUBLIC_CHAIN_ID` | Defaults to `8453` (Base) | ✅ default OK |
| `BLOCKED_COUNTRIES` | Defaults to `US` (server-only; never `NEXT_PUBLIC_`) | ✅ default OK |
| `NEXT_PUBLIC_PARTNER_BROKER_ADDRESS` | If **unset**, fills go straight to OptionBook and **you earn nothing**. Set to the deployed PartnerFeeBroker (`0xA31E4cB8…dE1B`, Base, 10 bps) to skim 0.10% per fill → claimable via `claimPartnerFees(USDC)`. Build-time like all `NEXT_PUBLIC_*`. | **P0 — your revenue** |

---

## P0 — before real traffic

- [ ] **Vercel project setup:** import the repo, set **Production Branch = `main`**.
- [ ] **Push env vars to Vercel** — every value is ready in `.env.local`; this is a copy job. Set them all (don't paste only the ones you remember — the build throws on a zero `NEXT_PUBLIC_REFERRER_ADDRESS`, so referrer must be there too). Highest-impact one is **`NEXT_PUBLIC_RPC_URL`** (keyed Alchemy already in `.env.local`); without it prod falls back to the public Base RPC and rate-limits under any real load.
- [ ] **`NEXT_PUBLIC_PARTNER_BROKER_ADDRESS`** — set it in Vercel or **the deployed site earns you nothing** (silently routes straight to OptionBook, same class of loss as the old referrer-burn gate). It's `NEXT_PUBLIC_` ⇒ baked at build time, so set it *before* the prod build. Verified live 2026-06-30: a real $1 fill accrued 0.000999 USDC to the broker.

## P0.5 — broker fill must work before you flip the launch toggle

The broker path (taker → broker → OptionBook) has its own approval surface. Fixed in `6ad542e`: USDC is now approved to the **broker** (not the OptionBook) so the fill doesn't revert with `ERC20: transfer amount exceeds allowance`.

- [ ] **Redeploy** so prod includes `6ad542e` (and the fee-display + broker-aware DB-write commits).
- [ ] **Verify a broker fill end-to-end** (preview-bypass the waitlist — see launch toggle): Approve USDC → it approves the broker → place a bet → it fills with no second popup. Then confirm `accumulatedFees(USDC)` ticked up and `claimPartnerFees(USDC)` pays your wallet.
- [ ] ⚠️ **Do NOT unset `LAUNCH_MODE` (go fully live) until the above passes on the redeployed build** — otherwise the first real users hit the allowance revert.

## P1 — leaderboard + persistence

- [ ] Add Supabase env to Vercel (values in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service-role is server-only).
- [x] ✅ **Migration applied + verified (2026-06-14, via Supabase MCP)** against the live project the app reads (`dgtmgtxoylpmzwzsacrr` = `NEXT_PUBLIC_SUPABASE_URL`). `0001_leaderboard` recorded; `traders`/`trades`/`settlements` exist with RLS **on**; only `public read` SELECT policies (no public write); `leaderboard_v` has `security_invoker=true` + anon/authenticated SELECT grant; **security advisors return 0 lints**.
- [x] ✅ **Seeded** — `traders` already holds 2 rows incl. the owner/referrer address `0xe6c3…e7ef` (plus a `0x…0001` test placeholder, harmless). First cron run has something to scan.
- [x] ✅ **Leaderboard cron dropped from v1** (2026-06-15) — no `CRON_SECRET`, no Vercel cron, no Hobby once-a-day limit. Settlements sync on-demand via `GET /api/me/trades` when a trader views their portfolio (indexer + DB, free-tier OK). Re-add later (with a Job-1 `try/catch`) on a paid RPC if absent-trader accuracy ever matters.

## P2 — cheap wins

- [ ] **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** — value already in `.env.local`; just add it to Vercel. Without it, no WC-QR mobile connect (but app doesn't break).

## Pre-trust gates (run before pointing users at prod)

- [ ] **`node scripts/verify-sdk.mjs`** against the real RPC — pricing hard-gate (9 samples + 4 linearity assertions). Stop if any payout/multiplier is 0 or NaN. Also: `check-orders.mjs`, `check-markets.mjs`, `check-payouts.mjs`.
- [ ] **$1 mainnet smoke test** from the deployed URL (fresh browser profile, not localhost). The full 8 points (folded in from the now-removed `production_checklist.md`):
  1. Connect MetaMask on Base mainnet — wrong-chain toast appears if on the wrong network.
  2. Place a $1 PUMP bet on any ETH market with ≥1h to expiry.
  3. USDC **Approve** popup is instant (<1s) — the 80k gas pin works against your prod RPC. On the broker path this now approves the **broker** (verify the spender).
  4. Fill confirms on Basescan (tx link in the success toast).
  5. `/portfolio` shows the new position within ~1s (cache invalidation works).
  6. Leaderboard shows data or a clean empty state (no crash on empty `trades`).
  7. Win-card OG image renders with the correct amount + direction.
  8. WalletConnect QR works on mobile (Rainbow / Coinbase Wallet).
- [ ] **Broker monetization check** (new): after the smoke fill, confirm `accumulatedFees(USDC)` on `0xA31E4cB8…dE1B` ticked up and `claimPartnerFees(USDC)` from `0xe6c3…e7ef` pays out.

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
- [ ] **`option_id` backfill (historical, optional):** trades written before the `args[2]`→`args[3]` fix stored the seller address in `option_id` instead of the option contract. Harmless live (settlements match by `tx_hash` from the indexer), so only backfill once trade count makes it worth re-deriving from on-chain events.

---

## TL;DR for the next agent

```
1. Vercel: import repo, Production Branch = main
2. Copy env vars from .env.local into Vercel — values already exist:
   RPC (keyed) + referrer + Supabase x3 + WalletConnect ID   (NO CRON_SECRET — cron dropped)
   (NEXT_PUBLIC_* are build-time → set before build, redeploy to change)
3. ✅ DB DONE — migration applied, RLS verified, 2 traders seeded (Supabase MCP, 2026-06-14)
4. ✅ verify-sdk.mjs PASS (2026-06-15) — pricing hard gate cleared
5. $1 mainnet bet from the deployed URL
6. Ship
```
