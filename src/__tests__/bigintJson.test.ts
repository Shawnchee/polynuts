import { describe, it, expect } from 'vitest';
import {
  bigintReplacer,
  bigintReviver,
  stringifyWithBigint,
  parseWithBigint,
} from '@/lib/sdk/bigintJson';

// Regression guard: the positions cache once silently no-op'd because
// JSON.stringify throws on the bigint fields in a Position. These must survive a
// round-trip AS bigints (downstream code does bigint math on them).
describe('bigintJson', () => {
  it('round-trips bigint fields, restoring them as real bigints', () => {
    const position = {
      data: [
        {
          id: '1',
          amount: 123n,
          entryPrice: 4_560_000n,
          pnl: -42n,
          option: { strikes: [1n, 2n], expiry: 99, optionType: 0 },
          status: 'open',
        },
      ],
      ts: 1_700_000_000_000,
    };

    const back = parseWithBigint<typeof position>(stringifyWithBigint(position));

    expect(typeof back.data[0].amount).toBe('bigint');
    expect(back.data[0].amount).toBe(123n);
    expect(back.data[0].entryPrice).toBe(4_560_000n);
    expect(back.data[0].pnl).toBe(-42n);
    expect(back.data[0].option.strikes).toEqual([1n, 2n]);
    expect(back.data[0].option.expiry).toBe(99);
    expect(back.ts).toBe(1_700_000_000_000);
  });

  it('does not throw and preserves non-bigint values unchanged', () => {
    const value = { data: [], ts: 1, name: 'x', flag: true, nested: { n: 3 } };
    expect(() => stringifyWithBigint(value)).not.toThrow();
    expect(parseWithBigint(stringifyWithBigint(value))).toEqual(value);
  });

  it('raw JSON.stringify would have thrown (documents why this exists)', () => {
    expect(() => JSON.stringify({ x: 1n })).toThrow();
    expect(() => stringifyWithBigint({ x: 1n })).not.toThrow();
  });

  // The replacer/reviver are exported for direct use with JSON APIs too.
  it('replacer/reviver compose with JSON.stringify/parse directly', () => {
    const s = JSON.stringify({ a: 5n }, bigintReplacer);
    expect(JSON.parse(s, bigintReviver)).toEqual({ a: 5n });
  });
});
