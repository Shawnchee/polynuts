'use client';

import { ChevronDown } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';

/**
 * "How it settles" — concise, accurate resolution + cost disclosure for a money
 * screen. Progressive disclosure, styled to match the panel's "Trade details".
 *
 * Accuracy notes (verified against the Thetanuts SDK + market model — do not
 * loosen without re-checking):
 *  - Settlement reads a Chainlink price oracle via the HistoricalPriceConsumer
 *    TWAP consumer at expiry (chainConfig.twapConsumer / option.getChainlink-
 *    PriceFeed). It is NOT the Deribit spot the panel shows live, which is
 *    indicative only — calling this out prevents the price-to-beat header from
 *    being mistaken for the settlement source.
 *  - The taker pays only the option premium; there is no separate platform/
 *    taker fee, and that premium is the maximum loss (long option).
 *  - Fills are on-chain on Base from the user's own wallet (non-custodial).
 */
export function HowItSettles({ market }: { market: MarketView }) {
  return (
    <details className="mt-3 rounded-md border border-line bg-bg-subtle group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-text-muted hover:text-text">
        <span>How it settles</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-2.5 text-xs leading-relaxed text-text-muted">
        <p>
          <span className="font-semibold text-text">Resolution.</span> Settles
          automatically on-chain at expiry against a{' '}
          <span className="font-semibold text-text">Chainlink</span> price oracle,
          time-averaged around the settlement time to resist manipulation. The
          live {market.asset} price above is an indicative Deribit feed for
          guidance — not the settlement source.
        </p>
        <p>
          <span className="font-semibold text-text">Cost &amp; max loss.</span> The
          price you pay is the option premium — no separate platform or taker fee.
          That premium is the most you can lose.
        </p>
        <p>
          <span className="font-semibold text-text">Payout.</span> If your bet lands
          in the money at settlement, the payout is yours — your result appears in
          Portfolio once the market settles.
        </p>
        <p>
          <span className="font-semibold text-text">Custody.</span> You trade from
          your own wallet on Base; funds move directly between you and the on-chain
          contracts.
        </p>
      </div>
    </details>
  );
}
