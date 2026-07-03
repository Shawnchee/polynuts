'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { getReadClient } from '@/lib/sdk/clients';
import { intrinsicPayoutUsdc } from '@/lib/sdk/positionLogic';
import { useAppStore } from '@/store/app';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { cn } from '@/lib/utils';

/**
 * 10s auto-cancel countdown gate between clicking "Bet" and signing the
 * fill. Subscribes to the live Deribit feed for the relevant asset so the
 * displayed spot + projected payout-at-spot refresh tick-by-tick without
 * touching the parent TradePanel.
 *
 * `client.utils.calculatePayoutAtPrice` is a pure JS computation, so the
 * tick-driven update is cheap (no RPC). The structural max payout (what
 * the user sees in the panel) doesn't move; the projected payout-at-spot
 * does, and that's the number the user actually wants confirmed.
 */

const COUNTDOWN_SECS = 10;
// Beyond this age (ms) since the last price update, treat the spot as stale —
// grey it and stop asserting live status/slippage against a frozen value.
const STALE_PRICE_MS = 15_000;
// Spot move beyond this fraction triggers a soft warning ("price moved")
// at confirm time — but does NOT block the trade. The user already opted
// in, so we surface the move and let them decide.
const SLIPPAGE_WARN_THRESHOLD = 0.005;

export interface PendingTrade {
  market: MarketView;
  /** USDC amount the user typed into the panel */
  amount: number;
  /** Preview-derived contracts the order will fill at */
  numContracts: bigint;
  /** Preview-derived actual USDC cost in 6-dec (may be capped below amount) */
  totalCollateral: bigint;
  /** Structural max payout in 6-dec USDC — from useFillPayout */
  maxPayoutAtFill: bigint | null;
  /** Partner-broker fee in 6-dec USDC the taker pays on top of premium (0n when no broker). */
  feeUsdc: bigint;
  /**
   * OptionBook spender resolved at staging time. We snapshot this rather
   * than re-derive it inside confirmAndFillBet so the approval flow
   * (handleApprove) and the fill flow target THE SAME spender even if
   * `rawApiData.optionBookAddress` mutates between the two phases.
   */
  optionBookSpender: string;
}

export interface ConfirmTradeModalProps {
  pending: PendingTrade;
  /** Fires when the user explicitly confirms. */
  onConfirm: (slippageWarning: string | null) => void;
  /** Fires on countdown expiry, X click, or backdrop click. */
  onCancel: () => void;
}

export function ConfirmTradeModal({
  pending,
  onConfirm,
  onCancel,
}: ConfirmTradeModalProps) {
  const { market, amount, numContracts, totalCollateral, maxPayoutAtFill, feeUsdc } =
    pending;
  const client = getReadClient();

  // Subscribe to the asset price directly — narrow selector keeps the rest
  // of the page out of this render cycle when ticks arrive.
  const spot = useAppStore((s) =>
    market.asset === 'ETH'
      ? s.prices.ETH
      : market.asset === 'BTC'
      ? s.prices.BTC
      : undefined
  );
  // ...and the last-update timestamp for that asset, so we can flag a frozen
  // feed instead of presenting a stale quote as if it were live.
  const spotAt = useAppStore((s) =>
    market.asset === 'ETH'
      ? s.pricesAt.ETH
      : market.asset === 'BTC'
      ? s.pricesAt.BTC
      : undefined
  );
  // Re-evaluated on every countdown tick (~1/s), which is what flips this once
  // the feed goes quiet.
  const spotStale =
    typeof spot === 'number' && (spotAt == null || Date.now() - spotAt > STALE_PRICE_MS);

  // Refs for focus management — focus the primary action on open and trap
  // Tab within the dialog while it's mounted. Purely a11y; does not touch
  // the confirm/cancel logic or the countdown timing.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Snapshot the spot price at the moment the modal opened — used to
  // detect a meaningful move at confirm time.
  const openSpotRef = useRef<number | null>(null);
  useEffect(() => {
    if (openSpotRef.current == null && typeof spot === 'number') {
      openSpotRef.current = spot;
    }
  }, [spot]);

  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  // Absolute deadline captured ONCE on mount. Deriving the remaining seconds
  // from a fixed deadline (instead of decrementing state on each interval tick)
  // makes the countdown immune to the interval being torn down and recreated.
  const deadlineRef = useRef(Date.now() + COUNTDOWN_SECS * 1000);
  // Always invoke the LATEST onCancel, but WITHOUT making it an effect
  // dependency: TradePanel passes a fresh inline arrow on every render and
  // re-renders on every ~1s Deribit price tick. If the countdown effect
  // depended on `onCancel`, it would clear+restart the interval every tick —
  // which froze `secsLeft` at 10 and meant the modal never auto-cancelled.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    // Empty deps: the interval is created ONCE and reads the fixed deadline, so
    // prop-identity churn on onCancel can no longer stall or restart it. A
    // sub-second tick keeps the displayed number responsive while still landing
    // the auto-cancel promptly at the deadline.
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000)
      );
      setSecsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        // Defer one tick so we don't setState-while-rendering a sibling.
        setTimeout(() => onCancelRef.current(), 0);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Escape closes (== cancel).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Focus the primary (Confirm) button when the dialog opens so keyboard
  // and screen-reader users land on the affirmative action immediately.
  // Runs once on mount only.
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  // Focus trap — keep Tab / Shift+Tab cycling within the dialog so focus
  // can't escape to the page behind the modal. Pure a11y; the confirm and
  // cancel handlers are untouched.
  useEffect(() => {
    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, []);

  const isVanilla = market.family === 'vanilla';

  // calculatePayoutAtPrice wants numContracts in OPTION_SIZE (18) decimals,
  // but previewFillOrder hands back the 6-dec collateral scale — passing it
  // raw silently computes ~0 (verified against the SDK). Scale up by 10^12
  // so the projected payout and break-even below are real dollar figures.
  const sizeContracts = useMemo(
    () => (numContracts > 0n ? numContracts * 10n ** 12n : 0n),
    [numContracts]
  );

  const isCallDir =
    market.direction === 'PUMP' ? true : market.direction === 'DUMP' ? false : null;

  // Projected payout AT THE CURRENT SPOT — the "if it settled right now"
  // value. Routed through the shared intrinsic helper (ascending strikes +
  // call/put/spread/range decomposition) so it matches the portfolio's
  // unrealized-PnL mark exactly. Pure JS, fine to recompute every tick.
  const projectedPayout = useMemo(() => {
    if (!spot || sizeContracts <= 0n) return null;
    try {
      const settlement = client.utils.toPriceDecimals(spot);
      return intrinsicPayoutUsdc(market.strikesAsc, isCallDir, sizeContracts, settlement);
    } catch {
      return null;
    }
  }, [client, spot, sizeContracts, market, isCallDir]);

  // Break-even: settlement price at which projected payout exactly
  // equals the user's bet. For bounded structures we walk the strikes;
  // the SDK's projected-payout helper is linear-between-strikes, so a
  // single interpolation across the price band lands the right answer.
  const breakEven = useMemo(() => {
    if (isVanilla || sizeContracts <= 0n) return null;
    try {
      // Break even against the TRUE out-of-pocket cost = premium + broker fee,
      // so the break-even line agrees with the payout tone below (which compares
      // to premium + fee). Premium-only would understate the level the trade has
      // to reach to stop losing money.
      const betUsdc = BigInt(Math.round(amount * 1e6)) + feeUsdc;
      const lo = market.strikesAsc[0];
      const hi = market.strikesAsc[market.strikesAsc.length - 1];
      if (!lo || !hi) return null;
      const minP = (lo * 50n) / 100n;
      const maxP = (hi * 150n) / 100n;
      const STEPS = 64;
      let prev: { p: bigint; net: bigint } | null = null;
      for (let i = 0; i <= STEPS; i++) {
        const p = minP + ((maxP - minP) * BigInt(i)) / BigInt(STEPS);
        const payout =
          intrinsicPayoutUsdc(market.strikesAsc, isCallDir, sizeContracts, p) ?? 0n;
        const net = payout - betUsdc;
        if (prev) {
          const flip =
            (prev.net <= 0n && net > 0n) || (prev.net >= 0n && net < 0n);
          if (flip) {
            // Linear interpolation between prev.p and p where net crosses 0.
            const span = p - prev.p;
            const denom = net - prev.net;
            if (denom === 0n) return Number(client.utils.fromPriceDecimals(p));
            const t = (-prev.net * span) / denom;
            const bePrice = prev.p + t;
            return Number(client.utils.fromPriceDecimals(bePrice));
          }
        }
        prev = { p, net };
      }
      return null;
    } catch {
      return null;
    }
  }, [client, amount, feeUsdc, sizeContracts, market, isVanilla, isCallDir]);

  const projectedPayoutUsd =
    projectedPayout != null
      ? Number(client.utils.fromUsdcDecimals(projectedPayout))
      : null;
  const maxPayoutUsd =
    maxPayoutAtFill != null
      ? Number(client.utils.fromUsdcDecimals(maxPayoutAtFill))
      : null;

  // totalCollateral is the SDK-computed USDC premium (6-dec) from the
  // preview — already accounts for maker-cap clamping. Falls back to the
  // raw input only if the preview is mid-recompute.
  const premiumUsd =
    totalCollateral > 0n
      ? Number(client.utils.fromUsdcDecimals(totalCollateral))
      : amount;
  // The taker also pays the partner-broker fee on top of premium, so the true
  // out-of-pocket cost — and the break-even line the payout tone compares to —
  // is premium + fee.
  const feeUsd = feeUsdc > 0n ? Number(client.utils.fromUsdcDecimals(feeUsdc)) : 0;
  const costUsd = premiumUsd + feeUsd;

  function handleConfirm() {
    let warning: string | null = null;
    const openSpot = openSpotRef.current;
    if (spotStale) {
      // The feed is frozen, so `spot` equals `openSpot` only because neither has
      // moved on our side — NOT because the market is flat. Surface that instead
      // of silently reading "0% drift" off two identical stale values as if the
      // slippage check had passed against a live price.
      warning = `${market.asset} price feed looks stale — the spot shown may be out of date.`;
    } else if (openSpot != null && typeof spot === 'number' && openSpot > 0) {
      const drift = Math.abs(spot - openSpot) / openSpot;
      if (drift > SLIPPAGE_WARN_THRESHOLD) {
        const pct = (drift * 100).toFixed(2);
        warning = `${market.asset} moved ${pct}% since you opened this dialog — proceeding anyway.`;
      }
    }
    onConfirm(warning);
  }

  // Portal to <body> so the fixed overlay is positioned against the viewport,
  // NOT against TradePanel — whose `animate-fade-in` leaves a lingering
  // `transform: translateY(0)` (fill-mode: both) that establishes a containing
  // block and traps `position: fixed`. On mobile the panel sits far down the
  // page, so the trapped modal rendered off-screen and looked like "Bet does
  // nothing". Rendered client-side only (it's only ever shown after a click).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-trade-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-line bg-bg-elev p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2
              id="confirm-trade-title"
              className="text-md font-semibold text-text"
            >
              Confirm bet
            </h2>
            <DirectionTag direction={market.direction} />
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="press-scale rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-base font-medium leading-snug text-text">
          {market.question}
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-line bg-bg-subtle p-3">
          <Row
            label="Size"
            value={
              Number.isFinite(premiumUsd) ? `$${premiumUsd.toFixed(2)} USDC` : '—'
            }
          />
          {feeUsd >= 0.005 && (
            <Row label="Broker fee" value={`$${feeUsd.toFixed(2)} USDC`} />
          )}
          <Row
            label="Contracts"
            value={Number(
              client.utils.formatAmount(numContracts, 6, 4)
            ).toLocaleString('en-US', { maximumFractionDigits: 4 })}
          />
          <Row
            label={spotStale ? `${market.asset} spot (stale)` : `${market.asset} spot now`}
            value={
              typeof spot === 'number'
                ? `$${spot.toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}`
                : '—'
            }
            mono
            muted={spotStale}
          />
          {!isVanilla && (
            <Row
              label="If correct, max win"
              value={
                maxPayoutUsd != null
                  ? `+$${maxPayoutUsd.toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })}`
                  : '—'
              }
              tone="pump"
            />
          )}
          <Row
            label="Payout if it settled now"
            value={
              projectedPayoutUsd != null
                ? `$${projectedPayoutUsd.toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}`
                : '—'
            }
            tone={
              projectedPayoutUsd != null && projectedPayoutUsd >= costUsd
                ? 'pump'
                : 'dump'
            }
          />
          {breakEven != null && (
            <Row
              label="Break-even"
              value={`$${breakEven.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}`}
            />
          )}
        </div>

        <p className="mt-3 text-xs text-text-dim">
          {spotStale
            ? `The ${market.asset} price feed looks delayed — the spot above may be out of date. `
            : `Live numbers refresh from the ${market.asset} index. `}
          Trade settles at{' '}
          {new Date(market.expiry * 1000).toUTCString().slice(5, 22)} UTC.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onCancel}
            className="press-scale flex-1 rounded-md border border-line bg-surface py-2.5 text-sm font-medium text-text hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            className={cn(
              'press-scale flex-[1.5] rounded-md py-2.5 text-sm font-semibold text-white transition-colors',
              market.direction === 'PUMP'
                ? 'bg-pump hover:bg-pump/90 glow-pump'
                : market.direction === 'DUMP'
                ? 'bg-dump hover:bg-dump/90 glow-dump'
                : 'bg-range hover:bg-range/90 glow-range'
            )}
          >
            Confirm — auto-cancels in{' '}
            <span className="num tabular-nums">{secsLeft}</span>s
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  label,
  value,
  tone,
  mono,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'pump' | 'dump';
  mono?: boolean;
  /** Grey the value out (e.g. a stale spot) — overrides the tone colour. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          'font-medium',
          mono !== false && 'num tabular-nums',
          muted
            ? 'text-text-dim'
            : cn(
                tone === 'pump' && 'text-pump dark:text-pump-dark',
                tone === 'dump' && 'text-dump dark:text-dump-dark',
                !tone && 'text-text'
              )
        )}
      >
        {value}
      </span>
    </div>
  );
}
