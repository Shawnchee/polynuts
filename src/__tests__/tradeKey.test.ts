import { describe, it, expect } from 'vitest';
import { tradeKey } from '@/lib/txKey';

// Regression guard for the settlement-sync join bug: the DB stores tx hashes
// WITH the `0x` prefix and option_id lowercased, while the Thetanuts indexer
// returns hashes WITHOUT the prefix and addresses checksummed. A raw string
// compare therefore never matched, so settlements were never written and every
// settled trade stayed stuck on "FILLED" with no realized PnL.
describe('tradeKey', () => {
  const TX_0X = '0x877B8F1d3F6dE9C2a0E1bD4c5A6e7F8901234567abcdef0123456789abcdef012';
  const TX_BARE = '877b8f1d3f6de9c2a0e1bd4c5a6e7f8901234567abcdef0123456789abcdef012';
  const OPT_CHECKSUM = '0xAbC1230000000000000000000000000000000456';
  const OPT_LOWER = '0xabc1230000000000000000000000000000000456';

  it('matches a DB row (0x + lowercase) to the indexer row (bare + checksum)', () => {
    // DB side (what writeFillToDb / readUserTrades store)
    const dbKey = tradeKey(TX_0X, OPT_LOWER);
    // Indexer side (what getUserHistoryFromIndexer returns)
    const indexerKey = tradeKey(TX_BARE, OPT_CHECKSUM);
    expect(indexerKey).toBe(dbKey);
  });

  it('normalizes the 0x prefix on the tx hash', () => {
    expect(tradeKey(TX_0X, OPT_LOWER)).toBe(tradeKey(TX_BARE, OPT_LOWER));
  });

  it('normalizes option address casing', () => {
    expect(tradeKey(TX_0X, OPT_CHECKSUM)).toBe(tradeKey(TX_0X, OPT_LOWER));
  });

  it('keeps distinct trades distinct', () => {
    expect(tradeKey(TX_0X, OPT_LOWER)).not.toBe(
      tradeKey('0xdeadbeef', OPT_LOWER),
    );
    expect(tradeKey(TX_0X, OPT_LOWER)).not.toBe(
      tradeKey(TX_0X, '0x9999990000000000000000000000000000000000'),
    );
  });

  it('is null-safe (no throw on missing values)', () => {
    expect(tradeKey('', '')).toBe(':');
    // @ts-expect-error exercising the nullish guard
    expect(() => tradeKey(undefined, undefined)).not.toThrow();
  });
});
