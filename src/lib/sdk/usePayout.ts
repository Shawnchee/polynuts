'use client';

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getReadClient } from './clients';
import { getProbePrices, type MarketView } from './markets';

/**
 * On-chain max payout for a given market at a given numContracts size.
 *
 * Uses `client.option.simulatePayout(impl, price, strikes, numContracts)` —
 * the BaseOption ABI's pure simulatePayout (option.ts:491–510 in the SDK
 * source). It runs against the implementation contract directly, no
 * deployed option needed, and returns the on-chain payout result for the
 * given settlement price. We probe at the structural maxima per family
 * (see `getProbePrices`) and take the larger of the two for 4-strike
 * products.
 *
 * Cached forever per (impl, strikes, numContracts) — these are immutable
 * for a given market until expiry.
 */
async function fetchMaxPayoutForMarket(
  market: MarketView,
  numContracts: bigint
): Promise<bigint | null> {
  if (numContracts <= 0n) return null;
  const probes = getProbePrices(market.family, market.strikesContract);
  if (!probes) return null;

  const client = getReadClient();
  const results = await Promise.all(
    probes.map((price) =>
      client.option.simulatePayout(
        market.implementation,
        price,
        market.strikesContract,
        numContracts
      )
    )
  );
  return results.reduce((max, x) => (x > max ? x : max), 0n);
}

const PROBE_UNIT = 1_000_000n; // 1 USDC of contracts — used for per-unit max payout

/**
 * Per-unit max payout — the value used to derive the multiplier and odds.
 * `numContracts = 1 USDC` of contracts → returns max payout in 8-dec
 * collateral units. Multiplier is then `maxPayout / pricePerContract`.
 *
 * For the same (impl, strikes) tuple this is constant, so React Query
 * dedupes naturally across cards via the queryKey.
 */
export function useMarketBinaryFraming(market: MarketView | null) {
  const enabled = !!market && market.family !== 'vanilla';
  return useQuery({
    queryKey: market
      ? ['payout-unit', market.implementation, market.strikesContract.map(String), PROBE_UNIT.toString()]
      : ['payout-unit', null],
    queryFn: async () => {
      if (!market) return null;
      const maxPayout = await fetchMaxPayoutForMarket(market, PROBE_UNIT);
      if (maxPayout == null || maxPayout <= 0n) return null;

      // simulatePayout returns 6-dec USDC. pricePerContract is 8-dec.
      // Use the SDK's canonical scaleDecimals so the conversion stays in
      // sync if Thetanuts ever adjusts a token's decimal config.
      const client = getReadClient();
      const costPerContract6dec = client.utils.scaleDecimals(
        market.pricePerContract,
        8,
        6
      );
      if (costPerContract6dec === 0n) return null;
      const multiplier = Number(maxPayout) / Number(costPerContract6dec);
      if (!Number.isFinite(multiplier) || multiplier <= 1) return null;
      const yesProbability = Math.min(0.99, Math.max(0.01, 1 / multiplier));
      return { maxPayoutPerUnit: maxPayout, multiplier, yesProbability };
    },
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

/**
 * Batch variant — fetches binary framing for many markets at once.
 *
 * Markets are deduped by (implementation, strikesContract, pricePerContract)
 * before useQueries runs, so 200 markets with only 30 unique structures
 * register 30 queries instead of 200. Without this, React Query logged
 * "Duplicate Queries found" warnings for every shared key. Returns an
 * array aligned 1:1 with the input markets so existing consumers don't
 * have to change.
 */
export function useMarketBinaryFramings(markets: MarketView[]) {
  // Build the unique-structure list and a back-pointer from each
  // market index → its unique-structure index.
  const { uniqueMarkets, indexMap } = useMemo(() => {
    const seen = new Map<string, { market: MarketView; uniqueIdx: number }>();
    const unique: MarketView[] = [];
    const byInput: number[] = [];
    markets.forEach((m) => {
      const key = `${m.implementation}|${m.strikesContract
        .map(String)
        .join(',')}|${m.pricePerContract.toString()}`;
      const hit = seen.get(key);
      if (hit) {
        byInput.push(hit.uniqueIdx);
      } else {
        const idx = unique.length;
        unique.push(m);
        seen.set(key, { market: m, uniqueIdx: idx });
        byInput.push(idx);
      }
    });
    return { uniqueMarkets: unique, indexMap: byInput };
  }, [markets]);

  const uniqueResults = useQueries({
    queries: uniqueMarkets.map((m) => ({
      queryKey: [
        'payout-unit',
        m.implementation,
        m.strikesContract.map(String),
        m.pricePerContract.toString(),
        PROBE_UNIT.toString(),
      ],
      queryFn: async () => {
        if (m.family === 'vanilla') return null;
        const maxPayout = await fetchMaxPayoutForMarket(m, PROBE_UNIT);
        if (maxPayout == null || maxPayout <= 0n) return null;
        const client = getReadClient();
        const costPerContract6dec = client.utils.scaleDecimals(
          m.pricePerContract,
          8,
          6
        );
        if (costPerContract6dec === 0n) return null;
        const multiplier = Number(maxPayout) / Number(costPerContract6dec);
        if (!Number.isFinite(multiplier) || multiplier <= 1) return null;
        const yesProbability = Math.min(0.99, Math.max(0.01, 1 / multiplier));
        return { maxPayoutPerUnit: maxPayout, multiplier, yesProbability };
      },
      enabled: m.family !== 'vanilla',
      staleTime: Infinity,
      gcTime: 30 * 60_000,
    })),
  });

  // Re-expand to one entry per input market.
  return indexMap.map((uniqueIdx) => uniqueResults[uniqueIdx]);
}

/**
 * Realised "if correct" payout — uses the actual numContracts from
 * `previewFillOrder` against the impl's `simulatePayout`. This is the
 * exact amount the contract would pay out at the structural maximum,
 * with no homegrown decimal scaling.
 */
export function useFillPayout(
  market: MarketView | null,
  numContracts: bigint | null
) {
  const enabled = !!market && market.family !== 'vanilla' && !!numContracts && numContracts > 0n;
  return useQuery({
    queryKey: market && numContracts
      ? [
          'payout-fill',
          market.implementation,
          market.strikesContract.map(String),
          numContracts.toString(),
        ]
      : ['payout-fill', null],
    queryFn: async () => {
      if (!market || !numContracts) return null;
      return fetchMaxPayoutForMarket(market, numContracts);
    },
    enabled,
    staleTime: 60_000,
  });
}
