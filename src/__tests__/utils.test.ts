import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shortAddress, fmtUsd, fmtPct, fmtTimeLeft, isUrgent } from '@/lib/utils';

describe('shortAddress', () => {
  it('truncates a full address', () => {
    expect(shortAddress('0xabcdef1234567890abcdef1234567890abcdef12')).toBe(
      '0xabcd…ef12',
    );
  });

  it('returns the address as-is when short enough', () => {
    expect(shortAddress('0xabcdef')).toBe('0xabcdef');
  });

  it('handles empty string', () => {
    expect(shortAddress('')).toBe('');
  });

  it('respects custom head/tail lengths', () => {
    expect(shortAddress('0xabcdef1234567890', 4, 2)).toBe('0xab…90');
  });
});

describe('fmtUsd', () => {
  it('formats a sub-$1000 amount with 2 decimals', () => {
    expect(fmtUsd(9.99)).toBe('$9.99');
  });

  it('formats $0 correctly', () => {
    expect(fmtUsd(0)).toBe('$0.00');
  });

  it('drops decimals above $1000', () => {
    expect(fmtUsd(1500)).toBe('$1,500');
  });

  it('returns $0.00 for NaN', () => {
    expect(fmtUsd(NaN)).toBe('$0.00');
  });

  it('returns $0.00 for Infinity', () => {
    expect(fmtUsd(Infinity)).toBe('$0.00');
  });

  it('compact: uses K suffix above 1000', () => {
    expect(fmtUsd(2500, { compact: true })).toBe('$2.5K');
  });

  it('compact: uses M suffix above 1_000_000', () => {
    expect(fmtUsd(3_200_000, { compact: true })).toBe('$3.2M');
  });

  it('compact: does not abbreviate below 1000', () => {
    expect(fmtUsd(999, { compact: true })).toBe('$999.00');
  });
});

describe('fmtPct', () => {
  it('formats 0 digits', () => {
    expect(fmtPct(55.7)).toBe('56%');
  });

  it('formats with 2 decimal digits', () => {
    expect(fmtPct(55.678, 2)).toBe('55.68%');
  });

  it('returns em dash for NaN', () => {
    expect(fmtPct(NaN)).toBe('—');
  });

  it('returns em dash for Infinity', () => {
    expect(fmtPct(Infinity)).toBe('—');
  });
});

describe('fmtTimeLeft', () => {
  const NOW_SEC = 1_700_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SEC * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "expired" for past timestamps', () => {
    expect(fmtTimeLeft(NOW_SEC - 1)).toBe('expired');
  });

  it('formats minutes only', () => {
    expect(fmtTimeLeft(NOW_SEC + 20 * 60)).toBe('20m');
  });

  it('formats hours + minutes', () => {
    expect(fmtTimeLeft(NOW_SEC + 2 * 3600 + 15 * 60)).toBe('2h 15m');
  });

  it('formats days + hours', () => {
    expect(fmtTimeLeft(NOW_SEC + 3 * 86400 + 5 * 3600)).toBe('3d 5h');
  });

  it('returns — for NaN', () => {
    expect(fmtTimeLeft(NaN)).toBe('—');
  });
});

describe('isUrgent', () => {
  const NOW_SEC = 1_700_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SEC * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is urgent when under 30 minutes remain', () => {
    expect(isUrgent(NOW_SEC + 15 * 60)).toBe(true);
  });

  it('is not urgent when over 30 minutes remain', () => {
    expect(isUrgent(NOW_SEC + 31 * 60)).toBe(false);
  });

  it('is not urgent for expired timestamps', () => {
    expect(isUrgent(NOW_SEC - 1)).toBe(false);
  });
});
