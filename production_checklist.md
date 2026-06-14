# Polynuts — Production Checklist

Work through this top-to-bottom before going live. Items are ordered by dependency.

---

## 1. Vercel Environment Variables

Set all of these in your Vercel project → Settings → Environment Variables (Production).

### Non-negotiable (app breaks or loses money without these)

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_REFERRER_ADDRESS` | Your Gnosis Safe multisig address | Until this is set, every fill burns the referrer fee to `0x000…`. Set up a Safe first. |
| `NEXT_PUBLIC_RPC_URL` | Alchemy / QuickNode paid Base endpoint | Public Base RPC rate-limits the leaderboard scan (3 000-block event fetch) and breaks payout sims under load. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WC project ID | Without it, no mobile wallets. Free at https://cloud.walletconnect.com |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | Server-only — never `NEXT_PUBLIC_`. |
| `CRON_SECRET` | `openssl rand -hex 32` | Vercel Cron automatically sends this as `Authorization: Bearer <CRON_SECRET>` — the cron route now requires it. |
| `BLOCKED_COUNTRIES` | `US` (or expanded list) | **Renamed from `NEXT_PUBLIC_BLOCKED_COUNTRIES`** — if you had the old name set in Vercel, delete it and add this one. |

### Recommended

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Wire Sentry before launch — you'll find out about prod bugs from Telegram otherwise. `npm i @sentry/nextjs && npx @sentry/wizard@latest -i nextjs` |

---

## 2. Supabase — Production Database

- [ ] **Apply the migration** on your production Supabase project:
  ```
  supabase/migrations/0001_leaderboard.sql
  ```
  Can do via Supabase dashboard → SQL editor, or `supabase db push` if CLI is configured for production.

- [ ] **Verify RLS is active** — run this query in the SQL editor and confirm all three return `t`:
  ```sql
  select tablename, rowsecurity
  from pg_tables
  where schemaname = 'public'
    and tablename in ('traders', 'trades', 'settlements');
  ```

- [ ] **Seed the `traders` table** with at least one address so the cron has something to scan on first run. The cron is cold-start safe but won't self-populate. Insert via Supabase UI or run the cron manually once after placing a real trade.

---

## 3. Vercel Cron

`vercel.json` already has the cron defined (`*/30 * * * *`). Two things to confirm:

- [ ] **`CRON_SECRET` is set** (see section 1) — Vercel passes it automatically as `Authorization: Bearer` to cron requests. The GET route now rejects requests without it.
- [ ] **Confirm the cron fires POST, not GET** — `vercel.json` sends GET by default. The route supports both GET and POST with the same secret. Verify the Vercel dashboard shows the cron as active after deploy.

---

## 4. Build Gate — Run Locally Before Pushing

```sh
npm install          # ensure @supabase/ssr etc. are in node_modules
npm run typecheck    # must pass with 0 errors
npm run lint         # must pass
npm run test         # 82 tests, all green
npm run build        # must succeed — catches bundle/SSR errors that typecheck misses
```

---

## 5. Verification Scripts — Run Against Live Chain

These are the honest correctness gate. Run them **after** setting `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_REFERRER_ADDRESS` in your local `.env`:

```sh
node scripts/check-orders.mjs    # sanity: Odette is serving fresh orders
node scripts/check-markets.mjs   # all impls map to a direction, multipliers > 0
node scripts/check-payouts.mjs   # one sample per family — every maxPayout must be > 0
node scripts/verify-sdk.mjs      # 9 samples + 4 linearity assertions — HARD GATE
```

**Stop and investigate if any row shows `0` or `NaN` for payout or multiplier.** These scripts were the first honest read after the PnL formula fix — don't skip them.

---

## 6. Mainnet Smoke Test (10 min, spend $1)

Do this from a fresh browser profile against the production URL, not localhost.

- [ ] **Connect MetaMask on Base mainnet** — wrong-chain toast appears if on wrong network
- [ ] **Place a $1 PUMP bet** on any ETH market with ≥1h to expiry
- [ ] **USDC approve popup is instant** (<1s) — confirms the 80k gas pin works against your production RPC
- [ ] **Fill confirms on Basescan** — view tx link in success toast
- [ ] **`/portfolio` shows the new position within ~1s** — confirms cache invalidation is working
- [ ] **Leaderboard shows data or a clean empty state** — no crash if trades table is empty
- [ ] **Win-card OG image renders** — click the brag button, open the URL, confirm the image shows correct amount + direction
- [ ] **WalletConnect QR works on mobile** — scan with Rainbow or Coinbase Wallet

---

## 7. Data Migration Note — `option_id` field

The security review found that `TradePanel.tsx` was storing `args[2]` (the maker/seller address) as `option_id` instead of `args[3]` (the deployed option contract address). This is now fixed.

**Impact on existing data:** Any trades written before this deploy will have the seller address in the `option_id` column, not the option contract. These records are harmless to live operation (settlements are matched by `tx_hash` from the indexer, not `option_id` alone) but they are technically incorrect.

- [ ] **Decide whether to backfill** old `option_id` values. For v1 with a small trade count, this is optional — wait until you have enough trades that it matters, then backfill via the cron's recovery path which re-derives from on-chain events.

---

## 8. Not in v1 Scope — Do Not Do

Deferred by design. Listed here so nothing slips in at the last minute:

- AA wallet path (`fillOrder` branching for Coinbase Smart Wallet / Safe) — defer until first AA user reports breakage
- Vanilla settlement-price slider — pure UI gap, not a money risk
- Iron condor markets — RANGER serves RANGE today; track via `check-orders.mjs`
- ENS resolution on leaderboard
- Fee dashboard (`getAllClaimableFees`)
- Farcaster Frames, Telegram bot, copy trading, vaults — V2+

---

## TL;DR

```
1. Set 8 env vars in Vercel (REFERRER_ADDRESS + RPC_URL + WC_PROJECT_ID + Supabase x3 + CRON_SECRET + BLOCKED_COUNTRIES)
2. Apply supabase/migrations/0001_leaderboard.sql on production DB
3. npm install && npm run typecheck && npm run test && npm run build
4. node scripts/verify-sdk.mjs  ← HARD GATE, must pass
5. Place a $1 test bet on mainnet from production URL
6. Ship
```
