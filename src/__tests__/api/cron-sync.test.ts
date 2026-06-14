import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before imports that use them.
const mockSb = {
  from: vi.fn(),
  select: vi.fn(),
};
mockSb.from.mockReturnValue(mockSb);
mockSb.select.mockResolvedValue({ data: [{ address: '0xabc' }], error: null });

const mockClient = {
  provider: {
    getBlockNumber: vi.fn(async () => 1000000),
  },
  events: {
    getOrderFillEvents: vi.fn(async () => [
      {
        transactionHash: '0x' + 'a'.repeat(64),
        taker: '0xtaker',
        option: '0xoption',
        numContracts: 10000000n,
        price: 5000000n,
        referrer: '0xreferrer',
        blockNumber: 999000,
        logIndex: 0,
        maker: '0xmaker',
      },
    ]),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseService: vi.fn(() => mockSb),
}));

vi.mock('@/lib/supabase/sync', () => ({
  getSyncClient: vi.fn(() => mockClient),
  writeFillToDb: vi.fn(async () => undefined),
  syncSettlementsOnly: vi.fn(async () => ({ settlementsUpserted: 1 })),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/cron/sync-leaderboard/route';

function makeGetRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/sync-leaderboard', {
    method: 'GET',
    headers,
  });
}

function makePostRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/sync-leaderboard', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/sync-leaderboard', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_REFERRER_ADDRESS = '0xreferrer';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';
    mockSb.from.mockReturnValue(mockSb);
    mockSb.select.mockResolvedValue({ data: [{ address: '0xabc' }], error: null });
  });

  it('GET with CRON_SECRET returns 200', async () => {
    const res = await GET(makeGetRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET without auth returns 401', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('GET with x-vercel-cron header but no secret returns 401', async () => {
    const res = await GET(makeGetRequest({ 'x-vercel-cron': '1' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/cron/sync-leaderboard', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_REFERRER_ADDRESS = '0xreferrer';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';
    mockSb.from.mockReturnValue(mockSb);
    mockSb.select.mockResolvedValue({ data: [{ address: '0xabc' }], error: null });
  });

  it('POST with correct secret returns 200 with recoveredFills', async () => {
    const res = await POST(makePostRequest('Bearer test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.recoveredFills).toBe('number');
  });

  it('POST returns 401 for wrong secret', async () => {
    const res = await POST(makePostRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when CRON_SECRET env not set', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makePostRequest('Bearer anything'));
    expect(res.status).toBe(401);
  });
});
