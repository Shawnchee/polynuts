-- Lock waitlist + feedback to write-only via the SERVER, not the public anon key.
--
-- Context: 0002 (feedback) and 0004 (waitlist) granted anon/authenticated an
-- open INSERT policy (WITH CHECK true) so the browser could write submissions
-- directly with the public anon key. That left a direct-REST spam vector: anyone
-- holding the (public, by design) anon key could POST unlimited rows straight to
-- PostgREST, bypassing the form and its honeypot/rate limiting. Reads were never
-- possible (neither table has a SELECT policy), so this was abuse/spam — not a
-- data leak. Supabase's linter also flags it (rls_policy_always_true).
--
-- Both inserts now go through rate-limited, validated server routes
-- (/api/waitlist, /api/feedback) that write with SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. So we drop the public INSERT policies: with RLS still
-- enabled and NO policy, anon/authenticated can do nothing on these tables.
-- The service-role server routes are unaffected (they bypass RLS) and keep
-- working — they are now the only write path in.
--
-- DEPLOY ORDER: ship the app (server routes + updated forms) FIRST, then run
-- this migration. If you run it before the new code is live, the old browser
-- forms (anon insert) will start failing until the deploy lands.

drop policy if exists "waitlist anon insert" on public.waitlist;
drop policy if exists "feedback anon insert" on public.feedback;

-- RLS stays enabled on both tables. With no INSERT/SELECT/UPDATE/DELETE policy,
-- anon + authenticated are denied every operation; only service_role (server)
-- can write.
