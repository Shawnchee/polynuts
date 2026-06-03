-- Polynuts leaderboard schema.
-- Reads come through @supabase/ssr clients (anon key, read-only).
-- Writes are performed exclusively by the cron at
-- src/app/api/cron/sync-leaderboard/route.ts using SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. RLS below therefore exposes SELECT to anon while
-- denying public INSERT/UPDATE/DELETE.

create table if not exists public.traders (
  address text primary key,
  first_seen_at timestamptz not null default now(),
  display_name text,
  ens_name text
);

create table if not exists public.trades (
  id bigserial primary key,
  tx_hash text not null,
  option_id text not null,
  taker_address text not null references public.traders(address) on delete cascade,
  market_label text,
  -- PUMP | DUMP | RANGE — kept loose (text) so future directions don't need a migration
  side text,
  contracts numeric not null,
  notional_usdc numeric not null,
  entry_price numeric,
  created_at timestamptz not null default now(),
  unique (tx_hash, option_id)
);

create index if not exists trades_taker_idx on public.trades (taker_address);
create index if not exists trades_created_at_idx on public.trades (created_at desc);

create table if not exists public.settlements (
  id bigserial primary key,
  trade_id bigint not null references public.trades(id) on delete cascade,
  settle_price numeric,
  payout_usdc numeric not null,
  pnl_usdc numeric not null,
  is_win boolean not null,
  settled_at timestamptz not null default now(),
  unique (trade_id)
);

create index if not exists settlements_trade_idx on public.settlements (trade_id);

-- Aggregated view. Regular (non-materialized) view is sufficient until trader
-- count crosses ~10k; switch to a matview refreshed by the same cron after.
-- security_invoker = true keeps RLS-on-base-tables in effect when the view
-- is queried by anon/authenticated (Postgres 15+).
create or replace view public.leaderboard_v
with (security_invoker = true) as
select
  t.taker_address                                        as address,
  count(*)::int                                          as total_trades,
  coalesce(sum(case when s.is_win then 1 else 0 end), 0)::int as wins,
  case
    when count(s.id) = 0 then null
    else round(
      sum(case when s.is_win then 1 else 0 end)::numeric
        / count(s.id)::numeric * 100,
      2
    )
  end                                                    as win_rate,
  coalesce(sum(s.pnl_usdc), 0)                           as realized_pnl,
  max(t.created_at)                                      as last_trade_at
from public.trades t
left join public.settlements s on s.trade_id = t.id
group by t.taker_address;

-- RLS: public read, no public write. Cron uses service_role which bypasses.
alter table public.traders     enable row level security;
alter table public.trades      enable row level security;
alter table public.settlements enable row level security;

drop policy if exists "traders public read"     on public.traders;
drop policy if exists "trades public read"      on public.trades;
drop policy if exists "settlements public read" on public.settlements;

create policy "traders public read"     on public.traders     for select using (true);
create policy "trades public read"      on public.trades      for select using (true);
create policy "settlements public read" on public.settlements for select using (true);

-- Ensure the Data API can reach the view (anon/authenticated need explicit grants).
grant select on public.leaderboard_v to anon, authenticated;
