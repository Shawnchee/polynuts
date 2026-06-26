import { describe, it, expect } from 'vitest';
import type { Position } from '@thetanuts-finance/thetanuts-client';
import {
  mergeRowsDb,
  summaryFromDbRows,
  calendarEntriesFromDbRows,
  type TradeFormatter,
} from '@/lib/sdk/tradeHistoryView';
import type { DbTradeRow } from '@/lib/sdk/useTradeHistoryDb';

// A stub formatter standing in for `getReadClient().utils` so the merge can be
// exercised without a live client/RPC. Mirrors the real decimal scaling closely
// enough for assertions (6-dec amounts, 8-dec prices/strikes).
const fmt: TradeFormatter = {
  formatAmount: (amount, decimals) => String(Number(amount) / 10 ** decimals),
  fromPriceDecimals: (value) => String(Number(value) / 1e8),
  fromStrikeDecimals: (value) => String(Number(value) / 1e8),
};

function dbRow(overrides: Partial<DbTradeRow>): DbTradeRow {
  return {
    id: 0,
    tx_hash: '0x0',
    option_id: '0xopt',
    market_label: 'ETH $3,000',
    side: 'PUMP',
    contracts: 1,
    notional_usdc: 1,
    entry_price: 0.1,
    created_at: '2026-06-01T00:00:00.000Z',
    settle_price: null,
    payout_usdc: null,
    pnl_usdc: null,
    is_win: null,
    settled_at: null,
    settle_tx_hash: null,
    ...overrides,
  };
}

// Minimal open-position stub: `pnlUsd` is pre-populated so positionLogic.pnlUsd
// returns finite without touching the live client; no settlement/status so
// isOpen() is true. `entryTxHash` is 0x-prefixed + MIXED CASE on purpose to
// prove the normTx join reconciles it with a bare, lowercased DB hash.
function openPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'p1',
    entryTxHash: '0xAAA111',
    entryTimestamp: 1_700_000_000,
    amount: 1_000_000n, // 1 contract at 6-dec
    collateralDecimals: 6,
    entryPrice: 5_000n, // indexer mmPrice (~0.00005) — should be ignored for cost
    pnlUsd: '0',
    side: 'buyer',
    optionTypeRaw: 0, // → PUMP
    option: { underlying: 'ETH', strikes: [300_000_000_000n], optionType: 0 },
    ...overrides,
  } as unknown as Position;
}

describe('mergeRowsDb', () => {
  it('borrows the DB cost basis for an open position (not the indexer mmPrice)', () => {
    const pos = openPosition();
    // Matching DB fill, stored bare + lowercased (how the indexer/DB differ).
    const rows = [
      dbRow({ id: 1, tx_hash: 'aaa111', notional_usdc: 12.5, entry_price: 0.42 }),
    ];

    const merged = mergeRowsDb([pos], rows, fmt);
    const posRow = merged.find((r) => r.source === 'position');

    expect(posRow).toBeDefined();
    // Real premium from the DB, NOT contracts * mmPrice (~0.00005).
    expect(posRow!.usdc).toBe(12.5);
    expect(posRow!.entryPrice).toBe(0.42);
    expect(posRow!.status).toBe('OPEN');
    expect(posRow!.direction).toBe('PUMP');
  });

  it('dedupes a DB row that mirrors an open position (cross-format hash join)', () => {
    const pos = openPosition(); // entryTxHash 0xAAA111
    const rows = [
      dbRow({ id: 1, tx_hash: 'aaa111', notional_usdc: 12.5 }), // mirrors the position
      dbRow({ id: 2, tx_hash: '0xBBB222', notional_usdc: 5 }), // distinct fill
    ];

    const merged = mergeRowsDb([pos], rows, fmt);

    // One position row + one history row for the distinct fill — the mirrored
    // DB row must NOT also appear (that was the silent-duplicate failure mode).
    expect(merged).toHaveLength(2);
    expect(merged.filter((r) => r.source === 'position')).toHaveLength(1);
    expect(merged.some((r) => r.key === 'db-1')).toBe(false);
    expect(merged.some((r) => r.key === 'db-2')).toBe(true);
  });

  it('maps a settled DB row to a SETTLE row with realized PnL + payout proof', () => {
    const rows = [
      dbRow({
        id: 9,
        tx_hash: '0xCCC333',
        settled_at: '2026-06-20T00:00:00.000Z',
        pnl_usdc: 3,
        settle_price: 3200,
        settle_tx_hash: '0xclose',
        side: 'DUMP',
      }),
    ];

    const [row] = mergeRowsDb([], rows, fmt);

    expect(row.status).toBe('SETTLE');
    expect(row.realizedPnl).toBe(3);
    expect(row.settlePrice).toBe(3200);
    expect(row.settleTxHash).toBe('0xclose');
    expect(row.direction).toBe('DUMP');
  });

  it('sorts rows most-recent first', () => {
    const rows = [
      dbRow({ id: 1, tx_hash: '0x1', created_at: '2026-06-01T00:00:00.000Z' }),
      dbRow({ id: 2, tx_hash: '0x2', created_at: '2026-06-10T00:00:00.000Z' }),
    ];
    const merged = mergeRowsDb([], rows, fmt);
    expect(merged.map((r) => r.key)).toEqual(['db-2', 'db-1']);
  });
});

describe('summaryFromDbRows', () => {
  const settledRows = [
    dbRow({ id: 1, settled_at: '2026-06-20T00:00:00.000Z', pnl_usdc: 3, market_label: 'win-A' }),
    dbRow({ id: 2, settled_at: '2026-06-19T00:00:00.000Z', pnl_usdc: -1 }),
    dbRow({ id: 3, settled_at: null, pnl_usdc: null }), // open — ignored
  ];

  it('aggregates lifetime PnL, wins, win rate over SETTLED rows only', () => {
    const s = summaryFromDbRows(settledRows);
    expect(s.settledCount).toBe(2);
    expect(s.lifetimePnl).toBe(2); // 3 + (-1)
    expect(s.wins).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.bestTrade).toBe(3);
    expect(s.bestTradeLabel).toBe('win-A');
  });

  it('counts the current win streak from the most recent settle backward', () => {
    // Most recent (2026-06-20) is a win, the one before (-1) breaks it → streak 1.
    expect(summaryFromDbRows(settledRows).streak).toBe(1);
  });

  it('is empty-safe', () => {
    const s = summaryFromDbRows([]);
    expect(s).toMatchObject({ settledCount: 0, lifetimePnl: 0, wins: 0, winRate: 0, streak: 0 });
  });
});

describe('calendarEntriesFromDbRows', () => {
  it('emits one point per settled row and skips open ones', () => {
    const entries = calendarEntriesFromDbRows([
      dbRow({ settled_at: '2026-06-20T00:00:00.000Z', pnl_usdc: 3 }),
      dbRow({ settled_at: null, pnl_usdc: null }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].pnl).toBe(3);
    expect(entries[0].ts).toBe(Date.parse('2026-06-20T00:00:00.000Z'));
  });
});
