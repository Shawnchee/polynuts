-- Polynuts feedback schema.
-- INVERTS the leaderboard RLS posture (0001): visitors submit feedback, but
-- nobody reads it through the Data API. Anon + authenticated may INSERT; there
-- is intentionally NO public SELECT/UPDATE/DELETE policy, so submissions are
-- write-only from the client. The project owner reads rows in the Supabase
-- dashboard (service role bypasses RLS).

create table if not exists public.feedback (
  id            bigserial primary key,
  message       text not null check (char_length(message) between 1 and 2000),
  category      text,
  email         text,
  wallet_address text,
  page_path     text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Write-only from the client: anyone may INSERT (the column CHECK enforces a
-- non-empty, <=2000-char message). No SELECT/UPDATE/DELETE policy exists, so
-- those operations are denied to anon/authenticated by default under RLS.
drop policy if exists "feedback anon insert" on public.feedback;

create policy "feedback anon insert"
  on public.feedback
  for insert
  to anon, authenticated
  with check (true);
