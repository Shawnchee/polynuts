# Polynuts — TODO

Tracking against PRD v2.0. Items grouped by milestone, then by surface.
Closed items deleted as they ship; this file should be a real punch list,
not a graveyard.

---

## V1 (ship target) — remaining

### Trade flow
- [ ] **AA wallet path** — `TradePanel.handleBet` uses `optionBook.fillOrder` for everything. The SDK README explicitly steers Coinbase Smart Wallet / Safe to `encodeFillOrder` + `walletClient.sendTransaction`. Branch on `walletClient.account.type === 'smart'`. *(SHOULD FIX from trade-flow audit; defer until first AA user reports breakage.)*
- [ ] **Vanilla settlement preview** — vanilla calls/puts currently show "open-ended (vanilla option)" in the trade panel. SDK exposes `client.utils.calculatePayoutAtPrice(order, numContracts, settlementPrice)` (sync, pure). Show "if ETH closes at $X, you'd win $Y" with a slider for the settlement price.

### Production prep
- [ ] **Set `NEXT_PUBLIC_REFERRER_ADDRESS`** — currently `0x0000…0000`. Fees collected = 0 until this is set. Use a Gnosis Safe multisig per PRD §9 security guidance.
- [ ] **Set `NEXT_PUBLIC_RPC_URL` to a paid provider** — public Base RPC will rate-limit the leaderboard event scan. Alchemy or QuickNode.
- [ ] **Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** — without it, mobile wallets via WC v2 don't work. Free at cloud.walletconnect.com.
- [ ] **Domain** — register `polynuts.xyz` (or chosen).
- [ ] **Geo legal review** — middleware blocks US only; expand `BLOCKED_COUNTRIES` after review.
- [ ] **Sentry DSN wire-up** — logger sink at `src/lib/sdk/logger.ts` calls `globalThis.Sentry.captureMessage` if loaded; install `@sentry/nextjs` and configure DSN to actually capture.

---

## V1.1 (next sprint)

### Share / virality
- [ ] **Win-card share button** — `/api/win-card` route is live and emits a 1200×630 PNG. Wire it into the post-fill toast: "Share your win" → opens X/Farcaster intent with the OG URL. URL params must come from `useFillPayout` / `useMarketBinaryFraming` (already SDK-derived) — don't recompute from broken homegrown math.
- [ ] **`/profile/:address`** — public trader page with stats + recent bets + shareable card. Pulls from `getUserPositionsFromIndexer` + `getUserHistoryFromIndexer`.

### Polish
- [ ] **ENS resolution** on leaderboard rows + activity feed taker addresses.
- [ ] **Fee dashboard** — `client.optionBook.getAllClaimableFees(REFERRER_ADDRESS)` + `claimAllFees()`. Admin-only page, gated to referrer wallet.
- [ ] **Mobile bottom nav** — currently desktop nav scales down OK but PRD §11 wants a mobile-only bottom bar (Markets · Portfolio · Leaderboard · Activity).
- [ ] **`/markets/:id` detail page** — separate page with odds-history line chart (Recharts), structure tab, larger trade panel. Currently the trade panel lives inline on `/`.

### Data layer
- [ ] **`getMarketData` fallback** — `useMarketData()` hook exists but unused since Deribit takeover. Either wire as a fallback when Deribit is silent ≥10s, or delete.

---

## V2 (after traction)

- [ ] **RFQ / custom strike** — `client.optionFactory` + RFQ key management. Power-user feature.
- [ ] **Farcaster Frames** — bet directly from a Warpcast post.
- [ ] **Telegram bot** (`@polynuts_bot`).
- [ ] **Social profiles + follow system**.
- [ ] **Copy trading**.
- [ ] **Mobile PWA**.
- [ ] **Vault product** — `client.strategyVault` module.
- [ ] **IRON_CONDOR markets** — RANGE direction is currently served by RANGER (4-strike zone); proper iron condors need makers to post them on the OptionBook. Track when they appear via `scripts/check-orders.mjs`.

---

## Open PRD questions (PRD §14)

| # | Question | Status |
|---|---|---|
| 1 | Active OptionBook order count | ✓ ~355 active across PUT, INVERSE_CALL, LINEAR_CALL, CALL_SPREAD, PUT_SPREAD, CALL_FLY, PUT_FLY, RANGER. Verify via `node scripts/check-markets.mjs`. |
| 2 | Strike/expiry distribution | ✓ Same probe — by impl, by asset (ETH 111, BTC 140, plus SOL/DOGE/XRP/BNB/AVAX). |
| 3 | Referrer fee split bps | **Open** — call `client.optionBook.getReferrerFeeSplit(REFERRER_ADDRESS)` once a real referrer is set. |
| 4 | `polynuts.xyz` available | **Open** — registry lookup. |
| 5 | Referrer wallet | **Open** — needs Gnosis Safe multisig setup. |
| 6 | Iron condor orders on book? | ✓ Currently 0 IRON_CONDOR; 42 RANGER orders serve the RANGE direction. |
| 7 | `getBookDailyStats` coverage | ✓ Wired into `/leaderboard` header. |
| 8 | Geo-block jurisdictions beyond US | **Open** — needs legal review. |
| 9 | Active StrategyVault on Base | **V2** — defer. |

---

## Audit findings still open (low priority)

- [ ] `useMarketData` hook unused after Deribit migration — delete or wire as fallback. *(Data audit, SHOULD FIX.)*
- [ ] RFQ-side positions not surfaced on `/portfolio` — V2 deferral, but add a comment so the omission is intentional.
- [ ] Win-card route's homegrown `multiplier = payout / bet` recomputation works only if callers pass SDK-derived values. When wiring the share flow, take `payout` and `bet` from `useFillPayout` / `useMarketBinaryFraming` — never from the trade panel UI strings.

---

## Verification scripts

Already in `scripts/`. Run before merging anything that touches pricing/contracts:

| Script | What it checks |
|---|---|
| `node scripts/check-orders.mjs` | Live Odette order count + breakdown by impl + asset. Sanity check that markets are loadable. |
| `node scripts/check-markets.mjs` | All supported impls map to a direction; multipliers > 0 for non-vanilla. |
| `node scripts/check-payouts.mjs` | One representative order per family — premium, max payout, multiplier, implied probability. |
| `node scripts/verify-sdk.mjs` | 9 samples across families + 4 bet-size linearity assertions. The hard verification gate. |

---

## Commit conventions reminder

Format: `<type>(<scope>): <short>`
- type: `feat` `fix` `refactor` `chore` `docs`
- scope: `markets` `trade` `portfolio` `leaderboard` `activity` `sdk` `nav` `design-system` `auth` `geo` `repo`

Modular commits — one feature, page, or logical unit per commit. Never bundle.
