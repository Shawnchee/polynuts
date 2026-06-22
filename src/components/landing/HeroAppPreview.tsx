'use client';

import { useRouter } from 'next/navigation';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarkets } from '@/lib/sdk/useOrders';
import type { MarketView } from '@/lib/sdk/markets';

const DIR_ORDER: Record<MarketView['direction'], number> = { PUMP: 0, DUMP: 1, RANGE: 2 };

// Same selection logic as LiveMarkets: Polynuts is a BTC/ETH product, so the
// hero preview only showcases those. One market per (asset, direction),
// highest volume winning, then take the top two so the window shows a varied,
// real cross-section (typically BTC PUMP + BTC DUMP — green/rose contrast).
function pickTwo(markets: MarketView[]): MarketView[] {
  const best = new Map<string, MarketView>();
  for (const m of markets) {
    if (m.asset !== 'BTC' && m.asset !== 'ETH') continue;
    const key = `${m.asset}-${m.direction}`;
    const cur = best.get(key);
    if (!cur || m.availableUsdc > cur.availableUsdc) best.set(key, m);
  }
  return [...best.values()]
    .sort((a, b) =>
      a.asset === b.asset
        ? DIR_ORDER[a.direction] - DIR_ORDER[b.direction]
        : a.asset < b.asset
        ? -1
        : 1
    )
    .slice(0, 2);
}

function CardSkeleton() {
  return <div className="h-[148px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />;
}

/**
 * Product-as-hero: the real markets surface, live, framed as an app window.
 *
 * Renders actual <MarketCard> components fed by the same useMarkets() hook the
 * markets page uses — not a screenshot, so it never goes stale and the odds it
 * shows are real SDK-simulated payouts. Clicking a card deep-links into the app
 * with that market pre-selected (MarketsPage reads ?m=<id>).
 *
 * The body is scoped to data-theme="dark" so the embedded app cards always
 * render with the app's dark tokens — the landing chrome is hardcoded dark, so
 * a visitor whose global theme is light would otherwise see light cards on a
 * navy hero. The app never sets a `.dark` class, so this reproduces the exact
 * real-app card appearance.
 */
export function HeroAppPreview() {
  const router = useRouter();
  const { markets, isLoading } = useMarkets();
  const picks = pickTwo(markets);
  const showSkeleton = isLoading && picks.length === 0;
  const empty = !isLoading && picks.length === 0;

  return (
    <div className="relative w-full">
      {/* Faint top accent hairline — ties the frame to the brand without glow */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0e1119] shadow-2xl shadow-black/50">
        {/* Window titlebar */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/40" />
          </div>
          <div className="flex flex-1 justify-center">
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1 font-mono text-[10px] text-white/40">
              polynuts.app/markets
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-white/40">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            LIVE
          </span>
        </div>

        {/* Window body — real app cards, forced dark theme (see docblock) */}
        <div data-theme="dark" className="bg-[#131720] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Live markets</p>
            <span className="font-mono text-[10px] text-white/30">Base mainnet</span>
          </div>
          <div className="grid gap-3">
            {showSkeleton && (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            )}
            {picks.map((m) => (
              <MarketCard
                key={m.id}
                market={m}
                onSelect={(id) => router.push(`/markets?m=${encodeURIComponent(id)}`)}
              />
            ))}
            {empty && (
              <div className="rounded-xl border border-white/[0.06] px-4 py-10 text-center font-mono text-xs text-white/35">
                Markets load when you open the app.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
