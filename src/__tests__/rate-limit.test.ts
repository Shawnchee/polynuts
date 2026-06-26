import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimit, clientIp, rateLimitSize } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimit());

  it('allows up to the limit, then blocks', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('k', 5, 1000, t).allowed).toBe(true);
    }
    const blocked = rateLimit('k', 5, 1000, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('reports decreasing remaining within the window', () => {
    const t = 0;
    expect(rateLimit('k', 3, 1000, t).remaining).toBe(2);
    expect(rateLimit('k', 3, 1000, t).remaining).toBe(1);
    expect(rateLimit('k', 3, 1000, t).remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    expect(rateLimit('k', 1, 1000, 0).allowed).toBe(true);
    expect(rateLimit('k', 1, 1000, 500).allowed).toBe(false);
    // Window has rolled over.
    expect(rateLimit('k', 1, 1000, 1000).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(rateLimit('a', 1, 1000, 0).allowed).toBe(true);
    expect(rateLimit('a', 1, 1000, 0).allowed).toBe(false);
    // Different key has its own budget.
    expect(rateLimit('b', 1, 1000, 0).allowed).toBe(true);
  });

  it('caps the tracked-key count under a flood of distinct keys in one window', () => {
    const t = 1_000_000;
    // 12k distinct keys in the SAME window (nothing expires) — without a hard
    // eviction the Map would hold all 12k.
    for (let i = 0; i < 12_000; i++) rateLimit(`flood-${i}`, 5, 60_000, t);
    expect(rateLimitSize()).toBeLessThanOrEqual(10_000);
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    });
    expect(clientIp(req)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip, then a shared bucket', () => {
    const withReal = new NextRequest('http://localhost/', {
      headers: { 'x-real-ip': '198.51.100.2' },
    });
    expect(clientIp(withReal)).toBe('198.51.100.2');
    expect(clientIp(new NextRequest('http://localhost/'))).toBe('local');
  });

  it('prefers x-real-ip over x-forwarded-for (anti-spoof on Vercel)', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-real-ip': '198.51.100.5', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(clientIp(req)).toBe('198.51.100.5');
  });
});
