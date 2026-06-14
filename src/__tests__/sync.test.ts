import { describe, it, expect } from 'vitest';
import {
  bigintToNumber,
  usd8ToNumber,
  sideFromOptionType,
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
