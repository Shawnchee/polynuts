-- Record the partner-broker fee paid on each fill so realized PnL / win-rate can
-- be computed net of it.
--
-- Context: when NEXT_PUBLIC_PARTNER_BROKER_ADDRESS is set (it is in production),
-- the taker pays the option premium PLUS the broker's immutable feeBps (~0.10%)
-- on top. The settlement sync computes realized pnl as `payout - premium`, which
-- omits that fee — so PnL and is_win are ~0.1% optimistic and a payout that
-- clears the premium but NOT premium+fee shows a green "WON" on an actual net
-- loss. Storing the fee per trade lets syncSettlementsOnly / syncUserFromIndexer
-- net it out: `pnl_usdc = payout - premium - fee`, `is_win = pnl_usdc > 0`.
--
-- Additive + nullable: the column is read with COALESCE(fee_usdc, 0) everywhere,
-- so legacy rows (and any row where the fee is unknown) stay correct as 0. The
-- default OptionBook path (no broker) writes 0 — behaviour there is unchanged.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code that writes
-- fee_usdc (the fill-write path) and the sync that reads it. Applying it first is
-- safe on its own — the column simply sits nullable/backfilled-to-0 until the new
-- code lands; the reverse (new code writing a column that doesn't exist yet)
-- would 500 the fill-write.

alter table public.trades
  add column if not exists fee_usdc numeric;

-- Backfill every pre-existing row to 0 (no broker fee was recorded before this).
update public.trades
  set fee_usdc = 0
  where fee_usdc is null;
