# Leaderboard architecture

## Why a separate DB

On-chain reads (`getOrderFillEvents`) are capped at ~95k blocks by the SDK's
chunked filter — ~2.3 days on Base. The lifetime stats panel works because it
hits the Thetanuts indexer, but the indexer doesn't expose a per-trader rank
endpoint. We need our own store so the leaderboard survives RPC rate limits,
supports historical windows, and isn't tied to a single block-range scan.

## Schema

Three tables and one view in `supabase/migrations/0001_leaderboard.sql`:

- `traders` — one row per address. Optional ENS/display name for V1.1 polish.
- `trades` — one row per fill. Keyed on `(tx_hash, option_id)` so re-running
  the cron is idempotent. Stores side (PUMP/DUMP/RANGE), contracts, notional.
- `settlements` — one row per settled trade. `trade_id` is unique so we don't
  double-count wins.
- `leaderboard_v` — aggregates per trader: trades, wins, win rate, realized
  PnL, last trade. A regular view (not materialized) is fine until trader
  count crosses ~10k — at that point switch to a matview refreshed by the
  same cron.

RLS: read-only via `anon`/`authenticated`, no public writes. The cron uses
the service-role key (server-only) and bypasses RLS.

## Write strategy

Considered three options:

| Option | Strength | Why not |
| --- | --- | --- |
| (a) Client-side write after `fillOrder` + later on settle | Real-time | Lost if user closes tab before settle; multiple writers; CORS/anon-key footgun |
| (b) Server-side webhook from Thetanuts indexer | Real-time, push-based | We don't own the indexer; no webhook contract exists |
| (c) Periodic cron diffs `getUserHistoryFromIndexer` against DB | Idempotent, survives client crashes, single writer | Eventual consistency — leaderboard lags actual fills by up to one cron interval (~5 min) |

**Chosen: (c).** The lag is acceptable for a leaderboard surface — users
already accept the lifetime-stats card refreshing every 5 minutes. Single
writer keeps the dedupe logic trivial (`upsert on (tx_hash, option_id)`).

## Reorg handling

We do **not** reindex from chain ourselves. The Thetanuts indexer applies
its own confirmation policy before exposing a trade via
`getUserHistoryFromIndexer`. If a reorg invalidates a trade upstream, it
disappears from subsequent indexer responses; the cron's idempotent upsert
keeps writing what the indexer currently sees but never deletes — accept
this as a known limitation. If reorg-driven phantom rows become a real
issue, add a "last_seen_at" timestamp and prune rows the indexer stops
returning for >24h.

## What the user has to do

1. Create a Supabase project; copy URL + anon key + service-role key.
2. Set env vars in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `CRON_SECRET` (any long random string)
3. Apply the migration: `supabase db push` (or paste the SQL into the
   Supabase SQL editor).
4. Configure a cron to hit
   `POST /api/cron/sync-leaderboard` every 5 minutes with header
   `Authorization: Bearer ${CRON_SECRET}`. Either:
   - **Vercel Cron** — add to `vercel.json` `crons` array; Vercel injects
     the auth header if you use `${CRON_SECRET}` via env.
   - **Supabase Cron** (pg_cron + pg_net) — `select cron.schedule(...)`
     with `net.http_post(...)`.
