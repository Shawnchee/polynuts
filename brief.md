# Polynuts — Brief

## What It Is

Polynuts is a **non-custodial prediction market for crypto price direction**, built on Base mainnet. Users bet on whether BTC or ETH will **PUMP** (close above a strike), **DUMP** (close below), or **RANGE** (stay within a band) over a fixed window — today, tomorrow, or next week.

Max loss = your bet. Settlement is automatic and trustless. No account, no withdrawal request, no custody.

---

## The One-Line Pitch

> Polymarket's UX, Deribit's pricing infrastructure, and no one in the middle.

---

## What Makes It Different

### vs. Polymarket
| | Polynuts | Polymarket |
|---|---|---|
| Settlement | Automatic, on-chain oracle | Manual (UMA oracle, disputable) |
| Custody | Non-custodial (your wallet, your keys) | Custodial (USDC locked in their contracts) |
| Pricing | On-chain payout simulation (real option math) | AMM-driven (pool imbalance pricing) |
| Market types | Binary + spreads, butterflies, condors | Binary only |
| Markets | Crypto price direction (objective, instant) | Everything (often resolved slowly) |
| Infrastructure | Audited, live options vaults (Thetanuts V4) | Custom AMM |

### vs. Deribit / Traditional Options
- No options jargon. "Will ETH pump today?" instead of "Buy 0.5Δ call, $3200 strike."
- Fixed risk. No liquidation, no margin calls.
- Minimum bet $1. Accessible at any size.
- Wallet-native. No KYC, no account, no email.

### vs. Gains Network / GMX (perps framing)
- No leverage risk. Max loss is the bet.
- No funding rates. Clear binary outcome.
- Shorter time horizons (hourly/daily/weekly), not open-ended.

---

## The Technical Edge

**Polynuts is not a prediction market that hand-rolls its own AMM.** It's a frontend over Thetanuts V4 — an audited, institutional-grade options vault protocol live since 2021.

The difference matters:

- **Orders are maker-signed.** A market maker (professional options firm) sets the strike, premium, and collateral cap. Polynuts routes takers to the best available order.
- **Payout math is on-chain.** Every multiplier and implied probability shown in the UI comes from `simulatePayout()` called against the live contract — not a formula Polynuts invented.
- **Settlement is trustless.** The Deribit index price is recorded on-chain at expiry. Winners claim USDC without any Polynuts involvement.
- **No smart contract risk Polynuts controls.** The OptionBook and vault contracts are Thetanuts' — Polynuts is a referrer/aggregator.

---

## Technical Architecture

```
User Browser
│
├── Next.js 14 App Router (React 18, TypeScript, Tailwind)
│   ├── /markets  — browse active markets
│   ├── /market/[id] — trade panel (bet, approve, fill)
│   ├── /portfolio — open positions + PnL
│   ├── /leaderboard — ranked traders, win rates, PnL
│   └── /activity — per-wallet trade history
│
├── RainbowKit + wagmi (MetaMask, Coinbase Wallet, Rainbow, WalletConnect)
│
├── Thetanuts Client SDK (@thetanuts-finance/thetanuts-client)
│   ├── Odette API — ~350 active signed orders, polled every 30s
│   ├── previewFillOrder() — compute contracts + collateral before signing
│   ├── simulatePayout() — on-chain payout at any settlement price (for odds display)
│   ├── fillOrder() — submit signed tx to OptionBook contract on Base
│   └── getUserPositions/History() — indexer-backed position tracking
│
├── Base Mainnet (chainId 8453)
│   ├── OptionBook contract — receives fills, locks collateral
│   ├── Option contract (per fill) — holds user's position
│   └── Deribit oracle — posts settlement price at expiry
│
├── Supabase (Postgres + RLS)
│   ├── trades — write-on-fill, recovered by cron
│   ├── settlements — indexed from Thetanuts after expiry
│   └── leaderboard_v — view: win rate, realized PnL per address
│
└── Vercel Cron (every 30 min)
    └── /api/cron/sync-leaderboard — recover missed fills, sync settlements
```

**Stack:** Next.js 14 · React 18 · TypeScript · Tailwind · wagmi v2 · viem · ethers v6 · RainbowKit · React Query · Zustand · Supabase · Base mainnet

---

## Market Opportunity

**Prediction markets** are having their breakout moment. Polymarket hit $1B+ in monthly volume in 2024. The TAM is anyone who wants to express a directional view on anything — and crypto price direction is the most liquid, most globally accessible version of that.

**The gap Polynuts fills:**
- Polymarket markets on crypto price resolve slowly (manual oracle, hours of dispute window) and are custodial.
- On-chain options (Deribit, Lyra, Premia) are inaccessible to most retail users — options jargon, margin, Greeks.
- No one has combined **Polymarket-style UX** with **real options infrastructure** and **trustless settlement**.

**The regulatory angle:** Binary options on crypto price are simpler to structure compliantly than perps or leveraged products — no liquidation, no leverage, fixed risk per trade.

---

## Traction (As of Launch)

- **$4.4M** lifetime volume
- **10,899** trades executed
- **243** active markets at any moment
- **241** days live on mainnet
- ETH and BTC markets with intraday, daily, and weekly expiries
- ~350 orders always available from professional market makers

---

## How Polynuts Makes Money

Every fill includes a **referrer fee** built into the Thetanuts V4 protocol. Polynuts captures this fee (set via `NEXT_PUBLIC_REFERRER_ADDRESS`) on every bet — without touching user funds, without any custody.

This is a pure fee-on-fill model:
- No spread markup
- No protocol tax on winnings
- No hidden fees — the taker pays only the premium

---

## What's Next (V2+)

- **Mobile-first** — WalletConnect already works; native PWA or React Native shell
- **More assets** — SOL, DOGE, XRP, AVAX markets already served by Thetanuts; surface in UI
- **Copy trading** — one-click "follow this wallet's direction bets"
- **Farcaster Frames** — bet from a frame, share wins to feed
- **Maker interface** — let power users post their own orders
- **Vaults** — passive "bet-with-the-house" yield product

---

## Why Now

1. Base mainnet has the wallet density (Coinbase ecosystem, 10M+ users with Base wallets).
2. Thetanuts V4 infrastructure is live and audited — no smart contract build time.
3. Polymarket proved the prediction market UX works at scale. Polynuts is the version where settlement is trustless and pricing is honest.
4. The macro window for on-chain derivatives is open: DeFi summer II is perps + options + prediction markets, not just spot.
