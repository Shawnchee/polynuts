'use client';

import { useQuery } from '@tanstack/react-query';
import { TokenIcon } from '@/components/ui/TokenIcon';

/**
 * Live BTC / ETH spot prices in the hero, from Deribit's free public ticker
 * API (CORS-open, no key). This is real reference market data — the price you
 * are betting on — not Deribit instruments dressed up as Polynuts markets.
 */

interface Spot {
  asset: 'BTC' | 'ETH';
  price: number;
  change: number; // 24h % change
}

const INSTRUMENTS: { asset: Spot['asset']; instrument: string }[] = [
  { asset: 'BTC', instrument: 'BTC-PERPETUAL' },
  { asset: 'ETH', instrument: 'ETH-PERPETUAL' },
];

async function fetchSpot(asset: Spot['asset'], instrument: string): Promise<Spot> {
  const res = await fetch(
    `https://www.deribit.com/api/v2/public/ticker?instrument_name=${instrument}`
  );
  if (!res.ok) throw new Error(`Deribit ${res.status}`);
  const json = await res.json();
  const r = json.result ?? {};
  return {
    asset,
    price: Number(r.last_price ?? r.index_price ?? 0),
    change: Number(r.stats?.price_change ?? 0),
  };
}

function fmtPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 2 })}`;
}

function Chip({ spot }: { spot: Spot }) {
  const up = spot.change >= 0;
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs">
      <TokenIcon asset={spot.asset} size={16} />
      <span className="font-semibold text-white">{fmtPrice(spot.price)}</span>
      <span className={up ? 'text-green-400' : 'text-rose-400'}>
        {up ? '▲' : '▼'} {Math.abs(spot.change).toFixed(2)}%
      </span>
    </div>
  );
}

export function SpotTicker() {
  const { data, isError } = useQuery({
    queryKey: ['deribit-spot'],
    queryFn: () => Promise.all(INSTRUMENTS.map((i) => fetchSpot(i.asset, i.instrument))),
    refetchInterval: 20_000,
    staleTime: 15_000,
    retry: 1,
  });

  // Fail silently — a dead third-party endpoint should never leave a broken
  // element in the hero.
  if (isError) return null;

  return (
    <div className="flex items-center gap-2.5" aria-label="Live BTC and ETH spot prices">
      {data
        ? data.map((s) => <Chip key={s.asset} spot={s} />)
        : INSTRUMENTS.map((i) => (
            <div
              key={i.asset}
              className="h-[30px] w-28 animate-pulse rounded-full border border-white/[0.06] bg-white/[0.03]"
              aria-hidden
            />
          ))}
    </div>
  );
}
