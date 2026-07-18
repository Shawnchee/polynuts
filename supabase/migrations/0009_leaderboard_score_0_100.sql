-- Rescale the leaderboard score to a bounded 0..100 (was an unbounded sum).
-- Weighted so the maximum is exactly 100:
--   • win rate → 45 pts, but confidence-damped by settled_trades/10 so a tiny
--     sample (e.g. a lucky 1/1 = 100%) can't max the term.
--   • premium traded → 35 pts, saturating (sqrt) around ~$5k.
--   • activity (trades) → 20 pts, saturating (sqrt) around ~50 trades.
-- All terms are >= 0, so the score is naturally floored at 0 and capped at 100.
-- Weights + saturation points (5000, 50, 10) are tunable knobs.
--
-- Leaf view, nothing depends on it — drop+recreate. Keeps the SECURITY DEFINER
-- posture from 0008 (no security_invoker) so the anon aggregate still works
-- without anon reading the locked-down settlements table.

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
  round(
      45 * (case when settled_trades = 0 then 0
                 else wins::numeric / settled_trades::numeric end)
         * least(1, settled_trades::numeric / 10.0)          -- win rate (confidence-damped)
    + 35 * least(1, sqrt(total_premium / 5000.0))            -- premium traded (saturates ~$5k)
    + 20 * least(1, sqrt(total_trades::numeric / 50.0))      -- activity (saturates ~50 trades)
  )::int                     as score,
  last_trade_at
from base;

grant select on public.leaderboard_v to anon, authenticated;
