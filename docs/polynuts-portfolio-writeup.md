# Polynuts

**A crypto binary-options prediction-market betting dApp on Base mainnet — a Polymarket-style "PUMP / DUMP / will-it-stay-in-range" UX layered directly over the Thetanuts Finance on-chain options protocol.**

Polynuts takes a power-user financial primitive — on-chain options — and re-skins it as a one-tap bet. Where Thetanuts exposes calls, puts, spreads, butterflies, condors and rangers, Polynuts presents plain-English questions ("Will ETH close above $3,000 by 08:00 UTC?"), a single payout headline, and a one-click USDC stake. Every number a user sees — odds, multiplier, implied probability, max win — is derived from real on-chain option payouts, never invented.

## Key features

- **Markets with SDK-derived odds & multipliers.** Each market card shows a return multiplier and implied probability computed from the option's actual on-chain payout, not a homegrown pricing model.
- **One-click USDC bet (approve + fill) with a confirm step.** A separate max-uint256 `approve` (so future bets are a single popup) followed by `fillOrder`, gated behind a 10-second auto-cancelling confirm modal that shows projected payout-at-spot, break-even, and a slippage warning.
- **Wallet connect** via RainbowKit (injected, Coinbase, MetaMask, Rainbow, optional WalletConnect), pinned to Base.
- **Live on-chain portfolio & positions** read straight from the Thetanuts indexer, with PnL sourced from authoritative indexer fields.
- **Leaderboard** of per-trader win rate and realized PnL, backed by an off-chain Supabase aggregate over synced trades + settlements.
- **Trade-history / activity** view with lifetime PnL, win rate, best trade, and current streak.
- **Shareable "win" cards** rendered as dynamic OG images (`next/og`, edge runtime) with X and Farcaster share intents.
- **Geo-blocking** of restricted regions via Next.js edge middleware (307 redirect to a dedicated `/not-available` route).
- **Dark / light theme** with a pre-hydration boot script to avoid flash, and transition suppression so swapping the theme across a 250-card grid is one instant repaint.

## Notable engineering

- **Binary odds from on-chain payouts, zero homegrown decimal math.** Multipliers and implied probabilities come from probing the option implementation's pure `simulatePayout` at each family's structural-maximum strike (`maxPayout / pricePerContract`), using the SDK's own `scaleDecimals`/`fromUsdcDecimals` for every conversion. Strikes are re-sorted into each family's required contract order (PUT families descending, the rest ascending) because the API order is unreliable — verified live, since the wrong order silently returns a $0 payout.
- **Money-safety baked into the build.** A production build *fails loudly* if the referrer-fee address is missing or zero (otherwise every fill would burn referrer fees forever); the confirm modal auto-cancels after 10s; the OptionBook spender is snapshotted at staging time so approval and fill always target the same contract; `ensureAllowance` is idempotent to avoid a redundant second popup.
- **Trustworthy cross-product PnL.** Settled-position PnL is read from the indexer's `pnlUsd` / `pnlEntries[].costUsd` rather than a naive `amount × price` formula, which is *wrong* for inverse-collateral BTC/ETH spreads — the fallback path is documented as such.
- **Graceful degradation.** When Supabase isn't configured the leaderboard shows a "warming up" state and the rest of the app runs unaffected; geo data is absent off-Vercel, so requests pass through rather than over-blocking.
- **Query efficiency.** Payout simulations are deduped by `(implementation, strikes, price)` so 200 cards sharing 30 structures fire 30 queries, not 200, and immutable results are cached indefinitely.

## Tech stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS, with `class-variance-authority` + `tailwind-merge`
- **Wallet / chain:** wagmi + RainbowKit, viem & ethers v6
- **Options protocol:** `@thetanuts-finance/thetanuts-client` SDK (payout simulation, order preview, fill, error types)
- **Data layer:** `@tanstack/react-query`, zustand (client state)
- **Off-chain store:** Supabase (Postgres + Row-Level Security, service-role cron writer, anon read-only view) for leaderboard & trade history
- **Charts & UX:** recharts (payout P/L), sonner (toasts), lucide-react (icons), `next/og` (share cards)
- **Deploy target:** Base mainnet (chainId 8453)
