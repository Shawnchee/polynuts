'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { TradePanel } from '@/components/trade/TradePanel';
import { useAppStore } from '@/store/app';
import type { MarketView } from '@/lib/sdk/markets';

/**
 * Focused right-side sheet that carries the bet action. Replaces the old
 * always-on 320px rail: the market grid now spans full width, and picking any
 * market (card, hero CTA, or hot pill) slides this in so the action appears as
 * a deliberate, attention-grabbing surface right where the eye already is —
 * rather than a permanently-present, easy-to-ignore column.
 *
 * Open state is derived from `market != null`. Closing routes through the
 * parent's `onClose` (which clears the store selection). Escape and backdrop
 * clicks are ignored while a trade is mid-flight so someone halfway through a
 * confirm can't dismiss the panel from under themselves — the confirm modal
 * itself is portaled to <body> at z-[100], above this sheet.
 */
export function TradeDrawer({
  market,
  isLoading,
  onClose,
}: {
  market: MarketView | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const tradeInProgress = useAppStore((s) => s.tradeInProgress);
  const open = market != null;

  // Escape to close + body scroll lock while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tradeInProgress) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, tradeInProgress, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 lg:z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Place a bet"
    >
      {/* Backdrop — click to dismiss (blocked mid-trade). */}
      <button
        type="button"
        aria-label="Close bet panel"
        onClick={() => {
          if (!tradeInProgress) onClose();
        }}
        className="absolute inset-0 bg-black/40 animate-fade-in"
      />

      {/* Sheet — right-anchored on desktop, full-width on phones. */}
      <div className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-bg shadow-2xl animate-slide-in-right sm:w-[420px]">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <span className="label text-text-muted">Place a bet</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={tradeInProgress}
            className="press-scale inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          <TradePanel market={market} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
