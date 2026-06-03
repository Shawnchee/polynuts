# Polynuts UI/UX Polish Spec (production prep)

Single source of truth for the polish pass. Derived from the EXISTING token system
(`src/app/globals.css` + `tailwind.config.ts`) and ui-ux-pro-max best practices.
**This is a polish pass on a live, real-money app — preserve all behavior.**

## Hard rules (every agent)
1. **Do NOT change trading / data-fetch / on-chain logic.** Visual + copy + state-handling only.
2. **Use existing semantic tokens only** — `bg`/`bg-subtle`/`bg-elev`, `surface`/`surface-hover`,
   `line`, `text`/`text-muted`/`text-dim`, and status colors `pump` (up/yes/win),
   `dump` (down/no/loss), `range` (purple), `brand` (blue). **No new raw hex** in components.
3. **Component APIs stay backward-compatible** — never change a shared component's props/exports;
   visual-only edits. Other agents render these in parallel.
4. **Numbers are tabular.** Every price, USDC amount, odds %, multiplier, P/L, countdown, and
   table figure gets Tailwind `tabular-nums` (and `font-mono` where it already reads as data) so
   columns don't jitter. Format money with 2 decimals, large counts with `toLocaleString()`.
5. **Respect `prefers-reduced-motion`** for any new animation; transitions 150–300ms, ease-out.
6. **a11y:** contrast ≥4.5:1 on text, visible focus rings on interactive elements, `aria-label`
   on icon-only buttons, never color-as-only-signal (pair win/loss color with text/icon).
7. Only edit the files in YOUR ownership list. If you need a change in another agent's file,
   note it in your final report instead of editing it.

## Empty / loading / error states (the biggest gap)
- **Empty state pattern:** centered, `text-muted` headline + one line of guidance + a primary
  action (e.g. "Connect wallet", "Browse markets"). Never a blank panel or a bare "No data".
- **Loading:** skeleton blocks (reuse `components/portfolio/TableSkeleton.tsx` pattern;
  use Tailwind `animate-pulse`, no custom keyframes) when load > ~300ms. Reserve height to avoid layout shift.
- **Supabase-absent mode is normal**, not an error: when `hasSupabaseConfigClient()` is false the
  leaderboard / persisted activity show a friendly "Leaderboard is warming up — trade history
  populates once the indexer is connected" style empty state, NOT an error or infinite spinner.
- **New user (wallet connected, nothing yet):** portfolio/activity show "No positions yet" +
  a button to the markets page. Numbers render as `$0.00` / `—`, never `NaN`/`undefined`/`Infinity`.

## Per-surface notes
- **Markets / Home:** consistent card spacing on the 4/8px scale; odds bar + % aligned and tabular;
  countdown timers tabular; clear single primary CTA per card; good "no markets match filter" empty state.
- **Trade panel (MOST CONSERVATIVE — money UI):** clarity only. Make the fee/slippage/payout lines
  unambiguous and tabular; clear disabled/loading button states; keep the confirm-modal flow, slippage
  warning, and allowance logic exactly as-is.
- **Portfolio / Leaderboard / Activity:** real empty states (see above), skeletons while loading,
  tabular P/L with pump/dump color + sign, sortable-table semantics where tables exist.
- **404 / error pages:** on-brand (tokens + shell), one-line explanation + a recovery action
  ("Back to markets"). `error.tsx`/`global-error.tsx` expose a `reset()` retry button.

## Existing tokens (do not redefine)
Surfaces `--bg #131720 / --bg-elev #1E2432 / --surface #262D3D`; text `#EDF0F6 / muted #A1AABC /
dim #747C8E`; status pump `#22C55E`, dump `#F43F5E`, range `#A78BFA`, brand `#2563EB`.
Fonts: Inter (`font-sans`), JetBrains Mono (`font-mono`). Type scale xs10/sm12/base13/md15/lg18/xl24/2xl32.
