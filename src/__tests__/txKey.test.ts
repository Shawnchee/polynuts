import { describe, it, expect } from 'vitest';
import { normTx, prefixTx } from '@/lib/txKey';

// `normTx` / `prefixTx` are the shared canonicalizers that reconcile the
// Thetanuts indexer's bare, mixed-case hashes with our DB's 0x-prefixed,
// lowercased ones. `tradeKey` (which composes normTx) is covered in
// tradeKey.test.ts; these guard the two primitives directly so a regression in
// either surfaces here rather than as a silently-broken join downstream.
describe('normTx', () => {
  it('strips the 0x prefix and lowercases', () => {
    expect(normTx('0xABCdef')).toBe('abcdef');
  });

  it('lowercases an already-bare hash', () => {
    expect(normTx('ABCDEF')).toBe('abcdef');
  });

  it('handles an uppercase 0X prefix (lowercases before stripping)', () => {
    expect(normTx('0XABCDEF')).toBe('abcdef');
  });

  it('only strips a LEADING 0x, never an interior one', () => {
    expect(normTx('0xab0xcd')).toBe('ab0xcd');
  });

  it('is null/undefined/empty safe', () => {
    expect(normTx(null)).toBe('');
    expect(normTx(undefined)).toBe('');
    expect(normTx('')).toBe('');
  });
});

describe('prefixTx', () => {
  it('adds 0x to a bare hash', () => {
    expect(prefixTx('abcdef')).toBe('0xabcdef');
  });

  it('is idempotent on an already-0x hash (and lowercases)', () => {
    expect(prefixTx('0xABCDEF')).toBe('0xabcdef');
  });

  it('returns null for missing input so nullable columns stay null', () => {
    expect(prefixTx(null)).toBeNull();
    expect(prefixTx(undefined)).toBeNull();
    expect(prefixTx('')).toBeNull();
  });

  it('round-trips with normTx in both directions', () => {
    const bare = '643fecabc';
    expect(normTx(prefixTx(bare)!)).toBe(bare);
    expect(prefixTx(normTx('0x643FECABC'))).toBe('0x643fecabc');
  });
});
