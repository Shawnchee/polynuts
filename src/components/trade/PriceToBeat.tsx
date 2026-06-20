'use client';

import { Clock } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { Countdown } from '@/components/ui/Countdown';
import { cn } from '@/lib/utils';

/**
 * "Price to beat" header — the single most decision-relevant comparison on a
 * price-direction bet: where the underlying is RIGHT NOW vs the level it has to
 * reach (or stay within), plus how long is left. Mirrors Polymarket's
 * "Current $X / Price to Beat $Y / Ends in Z" hero, adapted to Thetanuts'
 * one-sided + range option structures.
 *
 * Correctness note: `direction` (PUMP/DUMP/RANGE) is not sufficient on its own
 * — butterflies are tagged PUMP/DUMP by the SDK impl name but are actually
 * peaked "near a price" bets, so we branch on `family`:
 *   - vanilla / spread → one-sided in-the-money boundary
 *       PUMP  → ITM above the lowest strike
 *       DUMP  → ITM below the highest strike
 *   - butterfly / condor / iron_condor / ranger → range-like
 *       ITM inside the band (inner pair for 4-strike, outer pair otherwise)
 * These boundaries match where each structure first has intrinsic value and
 * stay consistent with the question copy in markets.ts:generateQuestion.
 *
 * The status is a LIVE, right-now snapshot (labelled "now") — it can flip
 * before settlement, so we never claim the bet is won/lost.
 */

interface Target {
  /** 'be' (one-sided) vs 'stay' (range) — drives the "Needs to ___" verb. */
  mode: 'dir' | 'range' | 'none';
  /** "above $62,973" / "between $62K–$63K" */
  label: string;
  /** the directional preposition, for the cushion line ("above"/"below") */
  word: string;
  /** in-the-money right now; null when spot is unknown */
  itm: boolean | null;
  /** signed % cushion: >0 = ITM by this much, <0 = this far to go; null if unknown */
  cushionPct: number | null;
}

function fmtPrice(n: number): string {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtStrike(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function computeTarget(market: MarketView, spot: number | undefined): Target {
  const strikes = market.strikes; // ascending USD numbers
  const s: number | null =
    typeof spot === 'number' && Number.isFinite(spot) ? spot : null;

  if (!strikes || strikes.length === 0) {
    return { mode: 'none', label: '—', word: '', itm: null, cushionPct: null };
  }

  const f = market.family;

  // One-sided products: vanilla call/put and spreads.
  if (f === 'vanilla' || f === 'spread') {
    if (market.direction === 'PUMP') {
      const edge = strikes[0];
      return {
        mode: 'dir',
        word: 'above',
        label: `above ${fmtStrike(edge)}`,
        itm: s != null ? s >= edge : null,
        cushionPct: s != null && edge > 0 ? ((s - edge) / edge) * 100 : null,
      };
    }
    const edge = strikes[strikes.length - 1]; // DUMP — ITM below the highest strike
    return {
      mode: 'dir',
      word: 'below',
      label: `below ${fmtStrike(edge)}`,
      itm: s != null ? s <= edge : null,
      cushionPct: s != null && edge > 0 ? ((edge - s) / edge) * 100 : null,
    };
  }

  // Range-like products: butterfly (near mid) + condor / iron_condor / ranger.
  const lo = strikes.length >= 4 ? strikes[1] : strikes[0];
  const hi = strikes.length >= 4 ? strikes[2] : strikes[strikes.length - 1];
  let cushionPct: number | null = null;
  if (s != null && lo > 0 && hi > 0) {
    if (s < lo) cushionPct = ((s - lo) / lo) * 100; // below range (negative)
    else if (s > hi) cushionPct = ((hi - s) / hi) * 100; // above range (negative)
    else cushionPct = Math.min(((s - lo) / lo) * 100, ((hi - s) / hi) * 100); // smallest cushion
  }
  return {
    mode: 'range',
    word: 'between',
    label: `between ${fmtStrike(lo)}–${fmtStrike(hi)}`,
    itm: s != null ? s >= lo && s <= hi : null,
    cushionPct,
  };
}

export function PriceToBeat({
  market,
  spot,
}: {
  market: MarketView;
  spot?: number;
}) {
  const t = computeTarget(market, spot);
  const known = typeof spot === 'number' && Number.isFinite(spot);
  const itm = t.itm;

  const statusLabel =
    itm == null ? 'Waiting for price' : itm ? 'In the money' : 'Out of the money';
  const statusCls =
    itm == null
      ? 'bg-bg-elev text-text-dim'
      : itm
      ? 'bg-pump/15 text-pump dark:text-pump-dark'
      : 'bg-bg-elev text-text-muted';

  const cushionLine = (() => {
    if (t.cushionPct == null) return null;
    const abs = Math.abs(t.cushionPct).toFixed(2);
    if (t.mode === 'range') {
      return itm
        ? `${abs}% cushion to nearest edge · now`
        : `${abs}% outside the range · now`;
    }
    return t.cushionPct >= 0
      ? `${abs}% ${t.word} the line · now`
      : `${abs}% to go · now`;
  })();

  return (
    <div className="mt-3 rounded-md border border-line bg-bg-subtle px-3 py-2.5">
      {/* Live spot + countdown */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="label text-text-dim">{market.asset}</span>
          <span
            className={cn(
              'num text-lg font-bold tabular-nums',
              itm ? 'text-pump dark:text-pump-dark' : 'text-text'
            )}
          >
            {known ? fmtPrice(spot as number) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          <Countdown expirySec={market.expiry} className="text-sm" />
        </div>
      </div>

      {/* Target + live status */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          Needs to {t.mode === 'range' ? 'stay' : 'be'}{' '}
          <span className="font-semibold text-text">{t.label}</span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold',
            statusCls
          )}
        >
          {statusLabel}
        </span>
      </div>

      {cushionLine && (
        <div
          className={cn(
            'num mt-0.5 text-[11px] tabular-nums',
            itm ? 'text-pump dark:text-pump-dark' : 'text-text-dim'
          )}
        >
          {cushionLine}
        </div>
      )}
    </div>
  );
}
