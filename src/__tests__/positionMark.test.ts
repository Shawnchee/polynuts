import { describe, it, expect } from 'vitest';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import {
  intrinsicPayoutUsdc,
  markToMarketUsd,
  unrealizedPnlUsd,
} from '@/lib/sdk/positionLogic';
import { getReadClient } from '@/lib/sdk/clients';
import { normTx } from '@/lib/sdk/explorer';

// These tests exercise the REAL SDK utils (calculatePayoutAtPrice etc.) —
// they're pure functions, so getReadClient() never opens a network
// connection. This validates the decimal scaling (numContracts must be
// 18-dec) and the call/put/spread/range decomposition against the actual
// SDK, not a stand-in.

const E8 = 10n ** 8n; // strike / price decimals
// 0.0133 contracts in the indexer's 6-dec collateral scale.
const AMOUNT_6DEC = 13_300n;

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: '1',
    optionAddress: '0xopt',
    entryTxHash: '0xtx',
    side: 'buyer',
    buyer: '0xbuyer',
    status: 'active',
    optionStatus: 'active',
    amount: AMOUNT_6DEC,
    collateralDecimals: 6,
    entryPrice: 0n,
    pnl: 0n,
    pnlUsd: null,
    optionTypeRaw: 0,
    option: { underlying: 'ETH', strikes: [], expiry: 0, optionType: 0 },
    ...overrides,
  } as unknown as Position;
}

const usd = (v: bigint | null): number =>
  v == null ? NaN : Number(getReadClient().utils.fromUsdcDecimals(v));

describe('intrinsicPayoutUsdc — call/put spreads', () => {
  const SIZE = AMOUNT_6DEC * 10n ** 12n; // → 18-dec, what calculatePayoutAtPrice wants
  const strikes = [1750n * E8, 1800n * E8]; // $50-wide

  it('call spread pays the spread width when settling at/above the top', () => {
    const itm = usd(intrinsicPayoutUsdc(strikes, true, SIZE, 1800n * E8));
    expect(itm).toBeCloseTo(0.665, 3); // 0.0133 × $50
  });

  it('call spread pays ~0 below the lower strike', () => {
    const otm = usd(intrinsicPayoutUsdc(strikes, true, SIZE, 1700n * E8));
    expect(otm).toBeCloseTo(0, 6);
  });

  it('put spread pays the width when settling below the lower strike', () => {
    const itm = usd(intrinsicPayoutUsdc(strikes, false, SIZE, 1700n * E8));
    expect(itm).toBeCloseTo(0.665, 3);
  });

  it('put spread pays ~0 above the upper strike', () => {
    const otm = usd(intrinsicPayoutUsdc(strikes, false, SIZE, 1850n * E8));
    expect(otm).toBeCloseTo(0, 6);
  });
});

describe('intrinsicPayoutUsdc — range (4-strike condor)', () => {
  const SIZE = AMOUNT_6DEC * 10n ** 12n;
  // Pays inside [1750, 1800], ramps over the outer wings.
  const strikes = [1700n * E8, 1750n * E8, 1800n * E8, 1850n * E8];

  it('pays the inner width inside the band', () => {
    const inBand = usd(intrinsicPayoutUsdc(strikes, null, SIZE, 1775n * E8));
    expect(inBand).toBeCloseTo(0.665, 3); // inner gap = $50
  });

  it('pays ~0 outside the band', () => {
    expect(usd(intrinsicPayoutUsdc(strikes, null, SIZE, 1600n * E8))).toBeCloseTo(0, 6);
    expect(usd(intrinsicPayoutUsdc(strikes, null, SIZE, 1900n * E8))).toBeCloseTo(0, 6);
  });
});

describe('normTx — indexer (no 0x) vs DB (0x) hash join', () => {
  // The indexer returns entryTxHash WITHOUT 0x; our DB stores it WITH 0x.
  // normTx must canonicalize both to the same key or the premium join and
  // the fill-vs-position dedup silently break.
  const indexerHash = '877b8f8501caacf71c03d0c899aee0b7addb0d07d4d9fe5dfb2f88e97256527a';
  const dbHash = '0x877B8F8501CAACF71C03D0C899AEE0B7ADDB0D07D4D9FE5DFB2F88E97256527A';

  it('maps prefix-less and 0x-prefixed forms to the same key', () => {
    expect(normTx(indexerHash)).toBe(normTx(dbHash));
  });

  it('a Map keyed by the DB hash is hit by the indexer hash', () => {
    const m = new Map([[normTx(dbHash), 'row']]);
    expect(m.get(normTx(indexerHash))).toBe('row');
  });

  it('handles null/undefined', () => {
    expect(normTx(null)).toBe('');
    expect(normTx(undefined)).toBe('');
  });
});

describe('markToMarketUsd / unrealizedPnlUsd', () => {
  const callSpread = makePosition({
    implementationName: 'CALL_SPREAD',
    option: { underlying: 'ETH', strikes: [1750n * E8, 1800n * E8], expiry: 0, optionType: 0 },
  } as Partial<Position>);

  it('marks an ITM call spread to its intrinsic value', () => {
    expect(markToMarketUsd(callSpread, 1800)).toBeCloseTo(0.665, 3);
  });

  it('marks an OTM call spread to ~0', () => {
    expect(markToMarketUsd(callSpread, 1700)).toBeCloseTo(0, 6);
  });

  it('unrealized PnL is −premium when OTM', () => {
    const premium = 0.5;
    expect(unrealizedPnlUsd(callSpread, 1700, premium)).toBeCloseTo(-0.5, 4);
  });

  it('unrealized PnL is positive (mark − premium) when ITM', () => {
    const premium = 0.5;
    expect(unrealizedPnlUsd(callSpread, 1800, premium)).toBeCloseTo(0.165, 3);
  });

  it('returns NaN without a live spot', () => {
    expect(markToMarketUsd(callSpread, undefined)).toBeNaN();
    expect(unrealizedPnlUsd(callSpread, undefined, 0.5)).toBeNaN();
  });

  it('skips inverse-collateral (non-6-dec) products', () => {
    const inverse = makePosition({
      collateralDecimals: 18,
      implementationName: 'INVERSE_CALL',
      option: { underlying: 'ETH', strikes: [1800n * E8], expiry: 0, optionType: 0 },
    } as Partial<Position>);
    expect(markToMarketUsd(inverse, 2000)).toBeNaN();
  });
});
