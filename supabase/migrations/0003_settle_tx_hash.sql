-- Add the on-chain payout transaction hash to settlements so the portfolio can
-- surface a "Payout" Basescan link on settled rows — proof the buyer was paid.
--
-- This stores the option's CLOSE tx (h.closeTxHash from the indexer), which is
-- the tx that actually transfers the buyer's USDC payout. Verified on-chain
-- (2026-06-22): the separate `settle` tx only records the oracle settlement
-- price and moves no money to the buyer, so it is NOT the proof we want.
--
-- Additive + nullable: existing settlement rows backfill on the next
-- settlement sync (syncSettlementsOnly upserts on conflict (trade_id)).
-- Covered by the existing "settlements public read" SELECT policy.

alter table public.settlements
  add column if not exists settle_tx_hash text;
