-- Polynuts waitlist schema.
-- Mirrors the write-only RLS posture of feedback (0002): anon + authenticated
-- may INSERT, but there is intentionally NO public SELECT/UPDATE/DELETE policy,
-- so the list is write-only from the browser. The owner reads rows in the
-- Supabase dashboard (service role bypasses RLS) and exports them at launch to
-- email the people who signed up.

create table if not exists public.waitlist (
  id             bigserial primary key,
  -- Stored already-normalized (lowercased + trimmed) by the client. One CHECK
  -- keeps obvious junk out without pretending to fully validate an address.
  email          text not null
                   check (char_length(email) between 3 and 320
                          and position('@' in email) > 1),
  -- Optional wallet capture so early access / allowlisting can be gated by
  -- address at launch. Constrained to a 0x-prefixed 40-hex EVM address.
  wallet_address text
                   check (wallet_address is null
                          or wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  source         text,   -- ?ref= attribution (twitter, discord, …) for channel analytics
  referrer       text,   -- document.referrer at signup
  user_agent     text,
  created_at     timestamptz not null default now()
);

-- Dedupe on the normalized email. The client lowercases + trims and upserts
-- with ignoreDuplicates, so a re-submit silently no-ops instead of leaking a
-- unique-violation error back to the browser (no membership enumeration).
create unique index if not exists waitlist_email_key on public.waitlist (email);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- Write-only from the client: anyone may INSERT (column CHECKs enforce a
-- plausible email). No SELECT/UPDATE/DELETE policy exists, so those are denied
-- to anon/authenticated by default under RLS.
drop policy if exists "waitlist anon insert" on public.waitlist;

create policy "waitlist anon insert"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);
