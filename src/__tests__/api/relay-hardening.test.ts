import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase + sync for the /api/me/trades handlers exercised below.
vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseConfig: vi.fn(() => true),
  getSupabaseService: vi.fn(() => ({})),
}));
vi.mock('@/lib/supabase/sync', () => ({
  getSyncClient: vi.fn(() => ({})),
  syncSettlementsOnly: vi.fn(async () => ({ settlementsUpserted: 0 })),
  writeFillToDb: vi.fn(async () => undefined),
  verifyFillOnChain: vi.fn(async () => ({ ok: true, premiumUsdc: 5 })),
  deriveBrokerFeeUsdc: vi.fn(async () => 0),
  readUserTrades: vi.fn(async () => [] as unknown[]),
}));

import { NextRequest } from 'next/server';
import { GET as indexerGET } from '@/app/api/indexer/[[...path]]/route';
import { GET as orderbookGET } from '@/app/api/orderbook/[[...path]]/route';
import { GET as tradesGET, POST as tradesPOST } from '@/app/api/me/trades/route';
import { writeFillToDb, syncSettlementsOnly, readUserTrades } from '@/lib/supabase/sync';
import { resetRateLimit } from '@/lib/rate-limit';

const ADDR = '0x' + 'a'.repeat(40);
const TX = '0x' + 'b'.repeat(64);

function pctx(path?: string[]) {
  return { params: Promise.resolve({ path }) };
}

function okFetch() {
  return vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

// ── ITEM 1: proxy subpath allowlists ────────────────────────────────────────
describe('indexer proxy subpath allowlist', () => {
  let fetchMock: ReturnType<typeof okFetch>;
  beforeEach(() => {
    resetRateLimit();
    fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = () => new NextRequest('http://localhost/api/indexer/x');

  const allowed: string[][] = [
    ['api', 'v1', 'book', 'stats'],
    ['api', 'v1', 'book', 'stats', 'daily'],
    ['api', 'v1', 'book', 'user', ADDR, 'positions'],
    ['api', 'v1', 'book', 'user', ADDR, 'history'],
  ];
  for (const p of allowed) {
    it(`forwards allowlisted subpath /${p.join('/')}`, async () => {
      const res = await indexerGET(req(), pctx(p));
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://indexer.thetanuts.finance/${p.join('/')}`,
      );
    });
  }

  const blocked: (string[] | undefined)[] = [
    undefined, // root
    ['health'],
    ['api', 'state'],
    ['api', 'v1', 'factory', 'stats'], // real upstream route, but not one Polynuts uses
    ['api', 'v1', 'book', 'stats', 'protocol'],
    ['api', 'v1', 'book', 'user', ADDR], // missing action tail
    ['api', 'v1', 'book', 'user', ADDR, 'positions', 'extra'],
    ['api', 'v1', 'book', 'user', 'not-an-address', 'positions'],
    ['admin'],
    ['internal', 'metrics'],
  ];
  for (const p of blocked) {
    it(`404s disallowed subpath /${p?.join('/') ?? '(root)'}`, async () => {
      const res = await indexerGET(req(), pctx(p));
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});

describe('orderbook proxy subpath allowlist', () => {
  let fetchMock: ReturnType<typeof okFetch>;
  beforeEach(() => {
    resetRateLimit();
    fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = () => new NextRequest('http://localhost/api/orderbook/x');
  const WORKER = 'https://round-snowflake-9c31.devops-118.workers.dev';

  it('forwards the worker root (fetchOrders / getMarketData)', async () => {
    const res = await orderbookGET(req(), pctx(undefined));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`${WORKER}/`);
  });

  it('forwards /orders (filterOrders)', async () => {
    const res = await orderbookGET(req(), pctx(['orders']));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`${WORKER}/orders`);
  });

  for (const p of [['x'], ['orders', 'extra'], ['..', 'secret'], ['admin']]) {
    it(`404s disallowed subpath /${p.join('/')}`, async () => {
      const res = await orderbookGET(req(), pctx(p));
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});

// ── ITEM 2: bound + sanitize market_label ───────────────────────────────────
describe('POST /api/me/trades market_label sanitization', () => {
  beforeEach(() => {
    resetRateLimit();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    vi.mocked(writeFillToDb).mockClear();
  });

  it('bounds length to 80 and strips control characters before writing', async () => {
    const dirty = 'ETH ' + '\u0000\u001b\n\r\t' + ' $2000 ' + 'A'.repeat(200);
    const res = await tradesPOST(
      new NextRequest('http://localhost/api/me/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_hash: TX,
          option_id: ADDR,
          taker_address: ADDR,
          market_label: dirty,
          side: 'PUMP',
          contracts: 10,
          notional_usdc: 5,
          entry_price: 0.05,
        }),
      }) as never,
    );
    expect(res.status).toBe(200);
    const written = vi.mocked(writeFillToDb).mock.calls.at(-1)![1] as {
      market_label: string;
    };
    expect(written.market_label.length).toBeLessThanOrEqual(80);
    // No C0/DEL/C1 control characters survive.
    expect(written.market_label).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
  });
});

// -- ITEM 3: gate settlement-sync amplification on the GET -------------------
describe('GET /api/me/trades settlement-sync gate', () => {
  function getReq() {
    const url = new URL('http://localhost/api/me/trades');
    url.searchParams.set('address', ADDR);
    return new NextRequest(url);
  }

  beforeEach(() => {
    resetRateLimit();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    vi.mocked(syncSettlementsOnly).mockClear();
    vi.mocked(readUserTrades).mockReset();
    vi.mocked(syncSettlementsOnly).mockResolvedValue({ settlementsUpserted: 0 });
  });

  it('skips the paid settlement sync when the address has no DB rows', async () => {
    vi.mocked(readUserTrades).mockResolvedValue([]);
    const res = await tradesGET(getReq() as never);
    expect(res.status).toBe(200);
    expect(syncSettlementsOnly).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.synced).toBeNull();
  });

  it('runs the settlement sync when the address already has rows', async () => {
    vi.mocked(readUserTrades).mockResolvedValue([{ id: 1 }] as never);
    const res = await tradesGET(getReq() as never);
    expect(res.status).toBe(200);
    expect(syncSettlementsOnly).toHaveBeenCalledOnce();
  });
});
