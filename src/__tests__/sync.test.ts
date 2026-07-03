import { describe, it, expect, afterEach } from 'vitest';
import { ethers } from 'ethers';
import {
  OPTION_BOOK_ABI,
  type Position,
  type TradeHistory,
} from '@thetanuts-finance/thetanuts-client';
import {
  bigintToNumber,
  usd8ToNumber,
  sideFromOptionType,
  findBuyerPosition,
  verifyFillOnChain,
  feeInclusiveRealized,
  feeUsdcOf,
  brokerFeeFromPremium,
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

  // Broker fills: the position row and the history row can disagree on `buyer`
  // (broker on one side, taker on the other), so buyer-equality finds nothing —
  // the entry tx hash is the precise join.
  const BROKER_BUYER = '0xBrokeR00000000000000000000000000000000004';
  const mkBrokerPos = (entryTxHash: string): Position =>
    ({ optionAddress: OPT, buyer: BROKER_BUYER, side: 'buyer', entryTxHash }) as unknown as Position;

  it('falls back to entry-tx match when the position buyer differs (broker fill)', () => {
    const pos = mkBrokerPos('0xaaa111');
    expect(findBuyerPosition(mkHist('aaa111'), [pos])).toBe(pos);
  });

  it('does not entry-tx-match a position on a different option', () => {
    const pos = ({ optionAddress: '0xOtheR0000000000000000000000000000000005', buyer: BROKER_BUYER, side: 'buyer', entryTxHash: '0xaaa111' }) as unknown as Position;
    expect(findBuyerPosition(mkHist('aaa111'), [pos])).toBeUndefined();
  });

  it('returns undefined when buyer differs AND the entry tx differs', () => {
    const pos = mkBrokerPos('0xzzz999');
    expect(findBuyerPosition(mkHist('aaa111'), [pos])).toBeUndefined();
  });
});

describe('feeInclusiveRealized', () => {
  it('flips a marginal win to a net loss once the broker fee is applied', () => {
    // Premium $100, payout $100.05 → +$0.05 before fee; a $0.10 broker fee makes
    // the trade a net LOSS. This is the case that used to render a green "WON".
    const basePnl = 100.05 - 100; // payout − premium
    const { pnl_usdc, is_win } = feeInclusiveRealized(basePnl, 0.1);
    expect(pnl_usdc).toBeCloseTo(-0.05, 6);
    expect(is_win).toBe(false);
  });

  it('keeps a clear win a win after the fee', () => {
    const { pnl_usdc, is_win } = feeInclusiveRealized(5, 0.1);
    expect(pnl_usdc).toBeCloseTo(4.9, 6);
    expect(is_win).toBe(true);
  });

  it('treats a missing/NULL fee as 0 (legacy + no-broker rows unchanged)', () => {
    expect(feeInclusiveRealized(0.05, null)).toEqual({ pnl_usdc: 0.05, is_win: true });
    expect(feeInclusiveRealized(0.05, undefined)).toEqual({ pnl_usdc: 0.05, is_win: true });
  });
});

describe('brokerFeeFromPremium', () => {
  it('is premium × feeBps / 1e4 (10 bps of a $5 premium = $0.005)', () => {
    expect(brokerFeeFromPremium(5, 10n)).toBe(0.005);
    expect(brokerFeeFromPremium(100, 10n)).toBe(0.1);
    expect(brokerFeeFromPremium(250, 25n)).toBe(0.625);
  });
  it('is 0 with no fee, no premium, or non-finite input (no-broker path stays free)', () => {
    expect(brokerFeeFromPremium(100, 0n)).toBe(0);
    expect(brokerFeeFromPremium(0, 10n)).toBe(0);
    expect(brokerFeeFromPremium(-5, 10n)).toBe(0);
    expect(brokerFeeFromPremium(Number.NaN, 10n)).toBe(0);
  });
  it('rounds to 6-dp USDC precision', () => {
    // 3.333333... × 10 / 1e4 = 0.00333333… → quantized to 6 dp
    expect(brokerFeeFromPremium(3.3333335, 10n)).toBe(0.003333);
  });
});

describe('feeUsdcOf', () => {
  it('coerces numeric strings, defaults NULL/garbage to 0', () => {
    expect(feeUsdcOf(0.1)).toBe(0.1);
    expect(feeUsdcOf('0.1')).toBeCloseTo(0.1, 6);
    expect(feeUsdcOf(null)).toBe(0);
    expect(feeUsdcOf(undefined)).toBe(0);
    expect(feeUsdcOf('not-a-number')).toBe(0);
  });
});

describe('verifyFillOnChain — partner broker path', () => {
  const IFACE = new ethers.Interface(OPTION_BOOK_ABI as ethers.InterfaceAbi);
  const TAKER = '0x1111111111111111111111111111111111111111';
  const BROKER = '0xa31e4cb8dcccb131cdc6bc9f2e280c522517de1b';
  const SELLER = '0x2222222222222222222222222222222222222222';
  const OPTION = '0x3333333333333333333333333333333333333333';
  const STRANGER = '0x9999999999999999999999999999999999999999';
  const TX = '0x' + 'a'.repeat(64);

  // A real, parseable OrderFilled log for the given buyer/option/premium.
  function fillLog(buyer: string, optionAddress: string, premium: bigint) {
    const { data, topics } = IFACE.encodeEventLog('OrderFilled', [
      1n, buyer, SELLER, optionAddress, premium, 0n, ethers.ZeroAddress, 0n, false,
    ]);
    return { topics, data };
  }
  const mkClient = (receipt: unknown) =>
    ({ provider: { getTransactionReceipt: async () => receipt } }) as never;

  const ORIG = process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS;
    else process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS = ORIG;
  });

  it('accepts a broker-routed fill (buyer=broker, sender=taker) when broker is configured', async () => {
    process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS = BROKER;
    const receipt = { from: TAKER, logs: [fillLog(BROKER, OPTION, 5_000_000n)] };
    expect(await verifyFillOnChain(mkClient(receipt), TX, TAKER, OPTION)).toEqual({
      ok: true,
      premiumUsdc: 5,
    });
  });

  it('still accepts a direct fill (buyer=taker)', async () => {
    process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS = BROKER;
    const receipt = { from: TAKER, logs: [fillLog(TAKER, OPTION, 3_000_000n)] };
    expect(await verifyFillOnChain(mkClient(receipt), TX, TAKER, OPTION)).toEqual({
      ok: true,
      premiumUsdc: 3,
    });
  });

  it('rejects a broker-buyer fill when NO broker is configured (regression guard)', async () => {
    delete process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS;
    const receipt = { from: TAKER, logs: [fillLog(BROKER, OPTION, 5_000_000n)] };
    const res = await verifyFillOnChain(mkClient(receipt), TX, TAKER, OPTION);
    expect(res.ok).toBe(false);
  });

  it('rejects when the tx sender is not the taker, even with a valid broker buyer', async () => {
    process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS = BROKER;
    const receipt = { from: STRANGER, logs: [fillLog(BROKER, OPTION, 5_000_000n)] };
    const res = await verifyFillOnChain(mkClient(receipt), TX, TAKER, OPTION);
    expect(res.ok).toBe(false);
  });

  it('rejects a buyer that is neither the taker nor the broker', async () => {
    process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS = BROKER;
    const receipt = { from: TAKER, logs: [fillLog(STRANGER, OPTION, 5_000_000n)] };
    const res = await verifyFillOnChain(mkClient(receipt), TX, TAKER, OPTION);
    expect(res.ok).toBe(false);
  });
});
