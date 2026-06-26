import { describe, it, expect } from 'vitest';
import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';
import {
  bigintToNumber,
  usd8ToNumber,
  sideFromOptionType,
  findBuyerPosition,
} from '@/lib/supabase/sync';

describe('bigintToNumber', () => {
  it('converts a 6-decimal USDC value', () => {
    // 1 USDC = 1_000_000 raw
    expect(bigintToNumber(1_000_000n, 6)).toBeCloseTo(1.0);
  });

  it('converts zero', () => {
    expect(bigintToNumber(0n, 6)).toBe(0);
  });

  it('handles negative values', () => {
    expect(bigintToNumber(-1_000_000n, 6)).toBeCloseTo(-1.0);
  });

  it('converts an 8-decimal price value', () => {
    // 0.05 at 8 decimals = 5_000_000
    expect(bigintToNumber(5_000_000n, 8)).toBeCloseTo(0.05);
  });

  it('handles large amounts without precision loss', () => {
    // 10,000 USDC
    expect(bigintToNumber(10_000_000_000n, 6)).toBeCloseTo(10_000);
  });
});

describe('usd8ToNumber', () => {
  it('converts a positive 8-decimal encoded value', () => {
    // 1 USD encoded as 100_000_000
    expect(usd8ToNumber('100000000')).toBeCloseTo(1.0);
  });

  it('returns null for null input', () => {
    expect(usd8ToNumber(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(usd8ToNumber(undefined)).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(usd8ToNumber('not-a-number')).toBeNull();
  });

  it('handles negative encoded values', () => {
    expect(usd8ToNumber('-50000000')).toBeCloseTo(-0.5);
  });

  it('handles zero', () => {
    expect(usd8ToNumber('0')).toBe(0);
  });
});

describe('sideFromOptionType', () => {
  it('maps type 0 (call) to PUMP', () => {
    expect(sideFromOptionType(0)).toBe('PUMP');
  });

  it('maps type 3 (put) to PUMP', () => {
    expect(sideFromOptionType(3)).toBe('PUMP');
  });

  it('maps type 1 to DUMP', () => {
    expect(sideFromOptionType(1)).toBe('DUMP');
  });

  it('maps type 4 to DUMP', () => {
    expect(sideFromOptionType(4)).toBe('DUMP');
  });

  it('maps type 2 to RANGE', () => {
    expect(sideFromOptionType(2)).toBe('RANGE');
  });

  it('maps type 5 to RANGE', () => {
    expect(sideFromOptionType(5)).toBe('RANGE');
  });

  it('returns null for unknown type', () => {
    expect(sideFromOptionType(99)).toBeNull();
  });
});

describe('findBuyerPosition', () => {
  const OPT = '0xOptioN0000000000000000000000000000000001';
  const BUYER = '0xBuyeR00000000000000000000000000000000002';
  const mkPos = (entryTxHash: string): Position =>
    ({ optionAddress: OPT, buyer: BUYER, side: 'buyer', entryTxHash }) as unknown as Position;
  // Indexer history rows carry the fill tx in `txHash` (prefix-less, the form
  // these rows are matched to their DB trade by).
  const mkHist = (txHash: string): TradeHistory =>
    ({ option: { address: OPT }, buyer: BUYER, txHash }) as unknown as TradeHistory;

  it('returns the single matching buyer position', () => {
    const p = mkPos('0xaaa111');
    expect(findBuyerPosition(mkHist('aaa111'), [p])).toBe(p);
  });

  it('disambiguates multiple same-option fills by entry tx (no PnL double-count)', () => {
    const p1 = mkPos('0xaaa111');
    const p2 = mkPos('0xbbb222');
    expect(findBuyerPosition(mkHist('bbb222'), [p1, p2])).toBe(p2);
    expect(findBuyerPosition(mkHist('aaa111'), [p1, p2])).toBe(p1);
  });

  it('falls back to the first candidate when no entry tx matches', () => {
    const p1 = mkPos('0xaaa111');
    const p2 = mkPos('0xbbb222');
    expect(findBuyerPosition(mkHist('ccc333'), [p1, p2])).toBe(p1);
  });

  it('returns undefined when nothing matches', () => {
    expect(findBuyerPosition(mkHist('aaa111'), [])).toBeUndefined();
  });
});
