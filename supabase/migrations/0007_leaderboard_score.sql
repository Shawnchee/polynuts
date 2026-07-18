-- Leaderboard: add premium-traded + a composite score. Realized PnL is NOT part
-- of the public score (a public score built from public inputs would let anyone
-- solve for PnL algebraically); win rate carries the performance signal instead.
--
-- Why two migrations: this one is BACKWARD-COMPATIBLE — it keeps realized_pnl on
-- the public view (appended new columns only) so the currently-deployed frontend
-- (which still selects/orders by realized_pnl) keeps working. 0008 drops
-- realized_pnl from the public view, locks the settlements base table, and
-- switches the view to security-definer — AFTER the new frontend ships. No
-- broken window.
--
-- `create or replace view` may only APPEND columns (same names/types/order for
-- the existing ones), so the 0001 order — address, total_trades, wins, win_rate,
-- realized_pnl, last_trade_at — is preserved and total_premium, score appended.

create or replace view public.leaderboard_v
with (security_invoker = true) as
with base as (
  select
    t.taker_address                                            as address,
    count(*)::int                                              as total_trades,
    coalesce(sum(case when s.is_win then 1 else 0 end), 0)::int as wins,
    count(s.id)::int                                           as settled_trades,
    coalesce(sum(t.notional_usdc), 0)::numeric                 as total_premium,
    coalesce(sum(s.pnl_usdc), 0)::numeric                      as realized_pnl,
    max(t.created_at)                                          as last_trade_at
  from public.trades t
  left join public.settlements s on s.trade_id = t.id
  group by t.taker_address
),
agg as (
  select
    address, total_trades, wins, total_premium, realized_pnl, last_trade_at,
    case when settled_trades = 0 then null
         else round(wins::numeric / settled_trades::numeric * 100, 2)
    end as win_rate,
    -- Polyscore — composite ranking metric, floored at 0. Weights are tunable.
    -- Volume + trade-count are sqrt-damped so whales / trade-farmers don't run
    -- away linearly. Realized PnL is deliberately excluded (win rate is the
    -- performance term) so the public score can't be inverted to recover PnL.
    greatest(0, round(
        sqrt(total_premium)                                       * 15   -- volume (USDC premium traded)
      + (case when settled_trades = 0 then 0
              else wins::numeric / settled_trades::numeric * 100 end) * 2   -- win rate (0..100)
      + sqrt(total_trades::numeric)                               * 20   -- activity (damped vs dust-trade farming)
    ))::int as score
  from base
)
select
  address,
  total_trades,
  wins,
  win_rate,
  realized_pnl,          -- BACKWARD-COMPAT ONLY; dropped from this public view in 0008
  last_trade_at,
  round(total_premium, 6) as total_premium,
  score
from agg;

grant select on public.leaderboard_v to anon, authenticated;

-- Admin-only mirror WITH realized_pnl, for the owner's /admin dashboard (read
-- with the service role). Deliberately NOT granted to anon/authenticated.
create or replace view public.leaderboard_admin_v
with (security_invoker = true) as
with base as (
  select
    t.taker_address                                            as address,
    count(*)::int                                              as total_trades,
    coalesce(sum(case when s.is_win then 1 else 0 end), 0)::int as wins,
    count(s.id)::int                                           as settled_trades,
    coalesce(sum(t.notional_usdc), 0)::numeric                 as total_premium,
    coalesce(sum(s.pnl_usdc), 0)::numeric                      as realized_pnl,
    max(t.created_at)                                          as last_trade_at
  from public.trades t
  left join public.settlements s on s.trade_id = t.id
  group by t.taker_address
)
select
  address,
  total_trades,
  wins,
  case when settled_trades = 0 then null
       else round(wins::numeric / settled_trades::numeric * 100, 2)
  end                        as win_rate,
  round(total_premium, 6)    as total_premium,
  realized_pnl,
  last_trade_at
from base;

revoke all on public.leaderboard_admin_v from anon, authenticated;
grant select on public.leaderboard_admin_v to service_role;
