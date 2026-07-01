'use client';

import { ChevronDown } from 'lucide-react';
import type { MarketView } from '@/lib/sdk/markets';
import { PARTNER_BROKER_ADDRESS } from '@/lib/sdk/clients';

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
 *  - Cost = premium, PLUS the partner-broker fee whenever a broker is
 *    configured (fills route through it and the taker pays premium + feeBps).
 *    The copy below is broker-aware so it never claims "no fee" while a fee is
 *    being charged — that total (premium + fee) is the maximum loss (long
 *    option). It matches the panel's "Max loss" (premium + fee).
 *  - Fills are on-chain on Base from the user's own wallet (non-custodial).
 */
export function HowItSettles({
  market,
  feeBps,
}: {
  market: MarketView;
  feeBps?: bigint | null;
}) {
  // Broker configured → a taker fee applies. Build-time NEXT_PUBLIC_ constant,
  // so this is statically correct for the deployment. Show the exact rate when
  // feeBps has loaded; otherwise a fee-aware phrasing without a hard number.
  const hasFee = !!PARTNER_BROKER_ADDRESS;
  const feePct =
    feeBps != null && feeBps > 0n ? `${(Number(feeBps) / 100).toFixed(2)}%` : null;
  // Built as a plain string so JSX whitespace rules can't drop a space between
  // the premium text and the interpolated fee clause.
  const costSentence = hasFee
    ? `You pay the option premium plus ${
        feePct ? `a ${feePct}` : 'a small'
      } partner-broker fee. That total — shown as “Max loss” above — is the most you can lose.`
    : 'The price you pay is the option premium — no separate platform or taker fee. That premium is the most you can lose.';
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
          <span className="font-semibold text-text">Cost &amp; max loss.</span>{' '}
          {costSentence}
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
