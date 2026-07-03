import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDays, type PnlEntry } from '@/components/activity/PnlCalendar';

const DAYS = 26 * 7;

// The heatmap's 26-week window always spans a DST transition for US/EU users.
// Pin a DST-observing timezone and a "today" whose window contains BOTH US 2024
// transitions so we exercise a 25-hour day (fall-back) and a 23-hour day
// (spring-forward). Fixed-ms cell stepping mis-keys cells across those
// boundaries; calendar-walked (setDate) stepping does not.
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/New_York';
});

afterAll(() => {
  process.env.TZ = originalTz;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Local-midnight epoch for a Y-M-D in the active timezone. */
function localMidnight(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

describe('PnlCalendar buildDays — DST-safe day bucketing', () => {
  it('generates exactly DAYS cells, each on a unique consecutive local date', () => {
    // 2025-03-20: window reaches back across fall-back 2024-11-03 (25h) and
    // spring-forward 2025-03-09 (23h).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 20, 12, 0, 0));

    const cells = buildDays([]);

    expect(cells).toHaveLength(DAYS);
    // No duplicate/skipped React keys at either DST boundary.
    expect(new Set(cells.map((c) => c.key)).size).toBe(DAYS);
    // Keys are one contiguous run of real local calendar days.
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1].date;
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      expect(cells[i].key).toBe(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
      );
    }
  });

  it('buckets trades on both DST boundary days into exactly one cell each', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 20, 12, 0, 0));

    const entries: PnlEntry[] = [
      { ts: localMidnight(2024, 10, 1), pnl: 10 }, // normal EDT day
      { ts: localMidnight(2024, 11, 3), pnl: 20 }, // fall-back (25h) day
      { ts: localMidnight(2024, 12, 25), pnl: 30 }, // normal EST day
      { ts: localMidnight(2025, 2, 14), pnl: 40 }, // normal EST day
      { ts: localMidnight(2025, 3, 9), pnl: 50 }, // spring-forward (23h) day
    ];

    const cells = buildDays(entries);

    for (const e of entries) {
      const d = new Date(e.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const matches = cells.filter((c) => c.key === key);
      expect(matches, `entry ${key} should map to exactly one cell`).toHaveLength(1);
      expect(matches[0].pnl).toBe(e.pnl);
      expect(matches[0].count).toBe(1);
    }
  });

  it('includes every in-window trade in the header net total', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 20, 12, 0, 0));

    const entries: PnlEntry[] = [
      { ts: localMidnight(2024, 11, 3), pnl: 20 }, // fall-back day
      { ts: localMidnight(2025, 3, 9), pnl: 50 }, // spring-forward day — dropped by fixed-ms stepping
      { ts: localMidnight(2025, 1, 15), pnl: -15 },
    ];
    const expectedNet = entries.reduce((s, e) => s + e.pnl, 0);

    const cells = buildDays(entries);
    // Header net = sum of cell PnL (see PnlCalendar totalPnl).
    const net = cells.reduce((s, c) => s + c.pnl, 0);

    expect(net).toBe(expectedNet);
  });
});
