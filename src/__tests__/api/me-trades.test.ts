import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase and sync before importing the route.
vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseConfig: vi.fn(() => true),
  getSupabaseService: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/sync', () => ({
  getSyncClient: vi.fn(() => ({})),
  syncSettlementsOnly: vi.fn(async () => ({ settlementsUpserted: 1 })),
  writeFillToDb: vi.fn(async () => undefined),
  verifyFillOnChain: vi.fn(async () => ({
    ok: true,
    onchain: { contracts: 10, notional_usdc: 5, entry_price: 0.05 },
  })),
  readUserTrades: vi.fn(async () => [
    {
      id: 1,
      tx_hash: '0x' + 'a'.repeat(64),
      option_id: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      market_label: 'ETH $2000',
      side: 'PUMP',
      contracts: 10,
      notional_usdc: 5,
      entry_price: 0.05,
      created_at: '2024-01-01T00:00:00Z',
      settle_price: null,
      payout_usdc: null,
      pnl_usdc: null,
      is_win: null,
      settled_at: null,
    },
  ]),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/me/trades/route';
import { hasSupabaseConfig } from '@/lib/supabase/server';
import { syncSettlementsOnly, writeFillToDb, verifyFillOnChain } from '@/lib/supabase/sync';
import { resetRateLimit } from '@/lib/rate-limit';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/me/trades');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const VALID_ADDR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const VALID_TX = '0x' + 'a'.repeat(64);

describe('GET /api/me/trades', () => {
  beforeEach(() => {
    resetRateLimit();
    vi.mocked(hasSupabaseConfig).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('returns 400 for missing address', async () => {
    const res = await GET(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid address/);
  });

  it('returns 400 for malformed address', async () => {
    const res = await GET(makeRequest({ address: 'not-an-address' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 503 when Supabase is not configured', async () => {
    vi.mocked(hasSupabaseConfig).mockReturnValue(false);
    const res = await GET(makeRequest({ address: VALID_ADDR }) as never);
    expect(res.status).toBe(503);
  });

  it('returns 200 with rows and settlement sync metadata', async () => {
    const res = await GET(makeRequest({ address: VALID_ADDR }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.synced).toEqual({ settlementsUpserted: 1 });
    expect(body.syncError).toBeNull();
  });

  it('still returns rows when settlement sync fails (graceful degradation)', async () => {
    vi.mocked(syncSettlementsOnly).mockRejectedValueOnce(new Error('indexer down'));
    const res = await GET(makeRequest({ address: VALID_ADDR }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.syncError).toBe('indexer down');
    expect(body.rows).toHaveLength(1);
  });

  it('returns 429 once the per-IP GET limit is exceeded', async () => {
    const ip = '203.0.113.7';
    const req = () => {
      const url = new URL('http://localhost/api/me/trades');
      url.searchParams.set('address', VALID_ADDR);
      return new NextRequest(url, { headers: { 'x-forwarded-for': ip } });
    };
    // 60 allowed, the 61st is throttled.
    for (let i = 0; i < 60; i++) {
      expect((await GET(req() as never)).status).toBe(200);
    }
    const res = await GET(req() as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('POST /api/me/trades', () => {
  const validPayload = {
    tx_hash: VALID_TX,
    option_id: VALID_ADDR,
    taker_address: VALID_ADDR,
    market_label: 'ETH $2000',
    side: 'PUMP',
    contracts: 10,
    notional_usdc: 5,
    entry_price: 0.05,
    created_at: '2024-01-01T00:00:00Z',
  };

  function makePost(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/me/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    resetRateLimit();
    vi.mocked(hasSupabaseConfig).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('returns 200 for a valid fill payload', async () => {
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // created_at is server-stamped — verify it's a valid ISO string close to now,
    // not the client-supplied value.
    const call = vi.mocked(writeFillToDb).mock.calls[0];
    const written = call[1] as { created_at: string };
    expect(Date.parse(written.created_at)).toBeGreaterThan(Date.now() - 5000);
    expect(written.created_at).not.toBe(validPayload.created_at);
  });

  it('writes on-chain economics, ignoring inflated client values', async () => {
    // Attacker reports a real tx but a hugely inflated notional to game the
    // leaderboard. The route must persist the verified on-chain numbers instead.
    vi.mocked(verifyFillOnChain).mockResolvedValueOnce({
      ok: true,
      onchain: { contracts: 7, notional_usdc: 2.1, entry_price: 0.3 },
    });
    const res = await POST(
      makePost({
        ...validPayload,
        contracts: 999,
        notional_usdc: 1_000_000,
        entry_price: 999,
      }) as never,
    );
    expect(res.status).toBe(200);
    const written = vi.mocked(writeFillToDb).mock.calls.at(-1)![1] as {
      contracts: number;
      notional_usdc: number;
      entry_price: number;
    };
    expect(written.contracts).toBe(7);
    expect(written.notional_usdc).toBe(2.1);
    expect(written.entry_price).toBe(0.3);
  });

  it('returns 400 for malformed tx_hash', async () => {
    const res = await POST(makePost({ ...validPayload, tx_hash: 'not-a-hash' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid side', async () => {
    const res = await POST(makePost({ ...validPayload, side: 'UP' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid option_id address', async () => {
    const res = await POST(makePost({ ...validPayload, option_id: 'not-an-address' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 503 when Supabase is not configured', async () => {
    vi.mocked(hasSupabaseConfig).mockReturnValue(false);
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(503);
  });

  it('returns 500 when the DB write fails', async () => {
    vi.mocked(writeFillToDb).mockRejectedValueOnce(new Error('db error'));
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(500);
  });

  it('returns 403 when on-chain verification fails (taker mismatch)', async () => {
    vi.mocked(verifyFillOnChain).mockResolvedValueOnce({ ok: false, reason: 'tx sender does not match taker_address' });
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/taker/);
  });

  it('returns 403 when on-chain verification fails (tx not found)', async () => {
    vi.mocked(verifyFillOnChain).mockResolvedValueOnce({ ok: false, reason: 'transaction not found on chain' });
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(403);
  });

  it('returns 403 when RPC call throws', async () => {
    vi.mocked(verifyFillOnChain).mockRejectedValueOnce(new Error('RPC timeout'));
    const res = await POST(makePost(validPayload) as never);
    expect(res.status).toBe(403);
  });

  it('returns 429 once the per-IP POST limit is exceeded', async () => {
    const ip = '203.0.113.9';
    const post = () =>
      new NextRequest('http://localhost/api/me/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(validPayload),
      });
    // 20 allowed, the 21st is throttled.
    for (let i = 0; i < 20; i++) {
      expect((await POST(post() as never)).status).toBe(200);
    }
    const res = await POST(post() as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
