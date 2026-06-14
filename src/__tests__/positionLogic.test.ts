import { describe, it, expect, vi } from 'vitest';
import type { Position, TradeHistory } from '@thetanuts-finance/thetanuts-client';

// Mock the SDK client so getReadClient() doesn't try to open a real RPC connection.
vi.mock('@/lib/sdk/clients', () => ({
  getReadClient: () => ({
    utils: {
      fromUsdcDecimals: (v: bigint) => String(Number(v) / 1e6),
      formatAmount: (v: bigint, dec: number) => String(Number(v) / 10 ** dec),
      fromPriceDecimals: (v: bigint) => String(Number(v) / 1e8),
    },
  }),
  POLYNUTS_CHAIN_ID: 8453,
  REFERRER_ADDRESS: '0x0000000000000000000000000000000000000000',
}));

import {
  isOpen,
  isSettled,
  isBuyerSettle,
  computeActivitySummary,
  findSettledPositionForHistory,
} from '@/lib/sdk/positionLogic';

// Minimal Position factory — only include fields the logic inspects.
function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    optionAddress: '0xoption',
    buyer: '0xbuyer',
    side: 'buyer',
    status: 'active',
    optionStatus: 'active',
    pnl: 0n,
    pnlUsd: null,
    pnlEntries: [],
    entryPrice: 0n,
    amount: 0n,
    collateralDecimals: 6,
    settlement: null as never,
    ...overrides,
  } as unknown as Position;
}

// Minimal TradeHistory factory.
function makeHistory(overrides: Partial<TradeHistory> = {}): TradeHistory {
  return {
    txHash: '0xtx',
    type: 'settle',
    buyer: '0xbuyer',
    option: { address: '0xoption', underlying: 'ETH' },
    strikes: [],
    amount: 0n,
    price: 0n,
    optionTypeRaw: 0,
    timestamp: 1_700_000_000,
    collateralDecimals: 6,
    settlement: {
      payoutBuyer: 1_000_000n, // 1 USDC
      settlementPrice: 200000000000n, // $2000 at 8 dec
    },
    closeTimestamp: '1700000100',
    ...overrides,
  } as unknown as TradeHistory;
}

describe('isOpen / isSettled', () => {
  it('treats an active position as open', () => {
    const p = makePosition();
    expect(isOpen(p)).toBe(true);
    expect(isSettled(p)).toBe(false);
  });

  it('treats a position with settlement as settled', () => {
    const p = makePosition({ settlement: { settlementPrice: 0n, payoutBuyer: 0n } as never });
    expect(isOpen(p)).toBe(false);
    expect(isSettled(p)).toBe(true);
  });

  it('treats optionStatus "expired" as settled', () => {
    const p = makePosition({ optionStatus: 'expired' as never });
    expect(isOpen(p)).toBe(false);
  });

  it('treats status "settled" as settled', () => {
    const p = makePosition({ status: 'settled' });
    expect(isOpen(p)).toBe(false);
  });
});

describe('isBuyerSettle', () => {
  it('returns true for a settle with matching buyer', () => {
    const h = makeHistory({ type: 'settle' });
    expect(isBuyerSettle(h, '0xbuyer')).toBe(true);
  });

  it('is case-insensitive', () => {
    const h = makeHistory({ type: 'settle' });
    expect(isBuyerSettle(h, '0xBUYER')).toBe(true);
  });

  it('returns true for exercise type', () => {
    const h = makeHistory({ type: 'exercise' });
    expect(isBuyerSettle(h, '0xbuyer')).toBe(true);
  });

  it('returns false for fill type', () => {
    const h = makeHistory({ type: 'fill' });
    expect(isBuyerSettle(h, '0xbuyer')).toBe(false);
  });

  it('returns false when no settlement data', () => {
    const h = makeHistory({ type: 'settle', settlement: null as never });
    expect(isBuyerSettle(h, '0xbuyer')).toBe(false);
  });

  it('returns false when address does not match', () => {
    const h = makeHistory({ type: 'settle' });
    expect(isBuyerSettle(h, '0xother')).toBe(false);
  });

  it('returns true when no address filter provided', () => {
    const h = makeHistory({ type: 'settle' });
    expect(isBuyerSettle(h)).toBe(true);
  });
});

describe('findSettledPositionForHistory', () => {
  it('matches by option address + buyer + side + settled', () => {
    const settled = makePosition({
      settlement: { settlementPrice: 0n, payoutBuyer: 0n } as never,
    });
    const h = makeHistory();
    expect(findSettledPositionForHistory(h, [settled])).toBe(settled);
  });

  it('returns undefined when positions is empty', () => {
    expect(findSettledPositionForHistory(makeHistory(), [])).toBeUndefined();
  });

  it('returns undefined when addresses do not match', () => {
    const p = makePosition({
      optionAddress: '0xother',
      settlement: { settlementPrice: 0n, payoutBuyer: 0n } as never,
    });
    expect(findSettledPositionForHistory(makeHistory(), [p])).toBeUndefined();
  });

  it('returns undefined for open (non-settled) position', () => {
    const p = makePosition(); // no settlement
    expect(findSettledPositionForHistory(makeHistory(), [p])).toBeUndefined();
  });
});

describe('computeActivitySummary', () => {
  // Each win/loss pair gets a unique option address so position matching is unambiguous.
  let _seq = 0;
  function makeWin(pnlRaw: number): { h: TradeHistory; p: Position } {
    const id = String(++_seq);
    const optionAddr = `0xoption${id}`;
    const h = makeHistory({
      type: 'settle',
      timestamp: Date.now() / 1000,
      option: { address: optionAddr, underlying: 'ETH' } as never,
    });
    const p = makePosition({
      optionAddress: optionAddr,
      settlement: { settlementPrice: 0n, payoutBuyer: 0n } as never,
      pnlUsd: String(Math.round(pnlRaw * 1e8)),
    });
    return { h, p };
  }

  it('returns zero stats for empty history', () => {
    const s = computeActivitySummary([], '0xbuyer', undefined, []);
    expect(s.lifetimePnl).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.settledCount).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.streak).toBe(0);
  });

  it('accumulates wins and lifetime PnL', () => {
    const { h: h1, p: p1 } = makeWin(10);
    const { h: h2, p: p2 } = makeWin(5);
    const s = computeActivitySummary(
      [h1, h2],
      '0xbuyer',
      undefined,
      [p1, p2],
    );
    expect(s.settledCount).toBe(2);
    expect(s.wins).toBe(2);
    expect(s.lifetimePnl).toBeCloseTo(15);
    expect(s.winRate).toBeCloseTo(1);
  });

  it('counts losses correctly', () => {
    const { h: h1, p: p1 } = makeWin(-3);
    const { h: h2, p: p2 } = makeWin(7);
    const s = computeActivitySummary(
      [h1, h2],
      '0xbuyer',
      undefined,
      [p1, p2],
    );
    expect(s.wins).toBe(1);
    expect(s.winRate).toBeCloseTo(0.5);
    expect(s.lifetimePnl).toBeCloseTo(4);
  });

  it('computes bestTrade correctly', () => {
    const { h: h1, p: p1 } = makeWin(3);
    const { h: h2, p: p2 } = makeWin(99);
    const s = computeActivitySummary(
      [h1, h2],
      '0xbuyer',
      undefined,
      [p1, p2],
    );
    expect(s.bestTrade).toBeCloseTo(99);
  });

  it('excludes non-settle history types', () => {
    const h = makeHistory({ type: 'fill' });
    const p = makePosition({ settlement: { settlementPrice: 0n, payoutBuyer: 0n } as never, pnlUsd: '1000000000' });
    const s = computeActivitySummary([h], '0xbuyer', undefined, [p]);
    expect(s.settledCount).toBe(0);
  });
});
