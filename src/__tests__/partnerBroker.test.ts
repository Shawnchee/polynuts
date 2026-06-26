import { describe, it, expect } from 'vitest';
import { computePartnerFee } from '@/lib/sdk/partnerBroker';

// Two-step truncation: usdcAmount → numContracts → re-derived premium → feeBps.
// These mirror what the broker charges on-chain (the integration-guide formula).
describe('computePartnerFee', () => {
  const PRICE_5c = 5_000_000n; // 0.05, 8-dec
  const TEN_USDC = 10_000_000n; // 10 USDC, 6-dec

  it('charges feeBps of the premium when the price divides evenly', () => {
    // 10 bps of 10 USDC = 0.01 USDC = 10_000 (6-dec). No truncation loss here.
    expect(computePartnerFee(TEN_USDC, PRICE_5c, 10n)).toBe(10_000n);
  });

  it('truncates at each step (result is ≤ the naive fee)', () => {
    // price 0.055 doesn't divide evenly, so numContracts + premium both floor.
    // numContracts = 1e15 / 5_500_000 = 181_818_181
    // premium      = 5_500_000 * 181_818_181 / 1e8 = 9_999_999
    // fee          = 9_999_999 * 50 / 10_000 = 49_999  (naive 50 bps would be 50_000)
    expect(computePartnerFee(TEN_USDC, 5_500_000n, 50n)).toBe(49_999n);
  });

  it('returns 0 when feeBps is 0', () => {
    expect(computePartnerFee(TEN_USDC, PRICE_5c, 0n)).toBe(0n);
  });

  it('returns 0 for a non-positive price (guards divide-by-zero)', () => {
    expect(computePartnerFee(TEN_USDC, 0n, 10n)).toBe(0n);
  });
});
