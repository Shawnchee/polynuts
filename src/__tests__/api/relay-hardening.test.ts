import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as indexerGET } from '@/app/api/indexer/[[...path]]/route';
import { GET as orderbookGET } from '@/app/api/orderbook/[[...path]]/route';
import { resetRateLimit } from '@/lib/rate-limit';

const ADDR = '0x' + 'a'.repeat(40);

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
