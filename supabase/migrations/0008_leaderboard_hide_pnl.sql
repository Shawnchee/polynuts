-- Finalize: stop Polynuts from serving per-trader realized PnL.
--   1. Drop realized_pnl from the PUBLIC leaderboard_v.
--   2. Revoke anon/authenticated read on the `settlements` base table — that was
--      the real leak: anyone with the public anon key could sum settlements.pnl_usdc
--      directly, regardless of what the view exposed.
--   3. Because the leaderboard aggregate reads settlements, switch leaderboard_v
--      to SECURITY DEFINER (drop security_invoker) so it runs with the view
--      owner's rights and the anon aggregate keeps working without anon having
--      direct settlements access. (Supabase's advisor flags definer views — this
--      is the intended pattern for exactly this case.)
--
-- APPLY ONLY AFTER the new frontend is deployed (that build no longer selects
-- realized_pnl from leaderboard_v; admin reads leaderboard_admin_v via the
-- service role, which bypasses RLS/grants).
--
-- NOTE — remaining, deliberately-not-closed surfaces (see "Recommended" scope):
--   • GET /api/me/trades?address=<any> still returns per-trade pnl_usdc for any
--     wallet (IP-rate-limited only). Left open by choice; gate behind a wallet
--     signature later if per-trade PnL must be private too.
--   • The Thetanuts indexer is public — any wallet's PnL is obtainable there
--     regardless of anything in this repo. So this is "not served by Polynuts",
--     not "private".
-- `trades` stays anon-readable (the recent-trades feed needs it; premium is
-- deliberately public).

-- 1 + 3: recreate the public view without realized_pnl, as SECURITY DEFINER.
drop view if exists public.leaderboard_v;

create view public.leaderboard_v as
with base as (
  select
    t.taker_address                                            as address,
    count(*)::int                                              as total_trades,
    coalesce(sum(case when s.is_win then 1 else 0 end), 0)::int as wins,
    count(s.id)::int                                           as settled_trades,
    coalesce(sum(t.notional_usdc), 0)::numeric                 as total_premium,
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
  greatest(0, round(
      sqrt(total_premium)                                       * 15
    + (case when settled_trades = 0 then 0
            else wins::numeric / settled_trades::numeric * 100 end) * 2
    + sqrt(total_trades::numeric)                               * 20
  ))::int                    as score,
  last_trade_at
from base;

grant select on public.leaderboard_v to anon, authenticated;

-- 2: lock the settlements base table from the public anon key. Nothing reads it
-- with the anon client (leaderboard now goes through the definer view above;
-- recent-trades reads `trades` only; all other settlement reads are service-role).
drop policy if exists "settlements public read" on public.settlements;
revoke select on public.settlements from anon, authenticated;
