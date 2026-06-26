import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase service client before importing the route. `upsert` is the
// terminal call we assert on; `from` returns the object that carries it.
type DbResult = { error: { message: string } | null };
const upsert = vi.fn(
  (..._args: [Record<string, unknown>, ...unknown[]]): Promise<DbResult> =>
    Promise.resolve({ error: null }),
);
const from = vi.fn((..._args: unknown[]) => ({ upsert }));

vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseConfig: vi.fn(() => true),
  getSupabaseService: vi.fn(() => ({ from })),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/waitlist/route';
import { hasSupabaseConfig } from '@/lib/supabase/server';
import { resetRateLimit } from '@/lib/rate-limit';

const VALID_ADDR = '0x' + 'a'.repeat(40);

function makePost(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/waitlist', () => {
  beforeEach(() => {
    resetRateLimit();
    from.mockClear();
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
    vi.mocked(hasSupabaseConfig).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('inserts a valid signup and returns 200', async () => {
    const res = await POST(makePost({ email: 'Foo@Bar.com', wallet_address: VALID_ADDR }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // Email is normalized server-side (lowercased + trimmed), wallet preserved.
    const row = upsert.mock.calls[0][0];
    expect(row.email).toBe('foo@bar.com');
    expect(row.wallet_address).toBe(VALID_ADDR);
  });

  it('returns 400 for an invalid email and writes nothing', async () => {
    const res = await POST(makePost({ email: 'not-an-email' }) as never);
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns 400 for a supplied-but-malformed wallet address', async () => {
    const res = await POST(makePost({ email: 'a@b.co', wallet_address: '0x123' }) as never);
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('allows a signup with no wallet (null)', async () => {
    const res = await POST(makePost({ email: 'a@b.co' }) as never);
    expect(res.status).toBe(200);
    expect(upsert.mock.calls[0][0].wallet_address).toBeNull();
  });

  it('honeypot: pretends success and writes nothing', async () => {
    const res = await POST(makePost({ email: 'a@b.co', company_website: 'spam' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reads user-agent from the request header, not the client body', async () => {
    await POST(makePost({ email: 'a@b.co' }, { 'user-agent': 'TestAgent/1.0' }) as never);
    expect(upsert.mock.calls[0][0].user_agent).toBe('TestAgent/1.0');
  });

  it('returns 503 when Supabase is not configured', async () => {
    vi.mocked(hasSupabaseConfig).mockReturnValue(false);
    const res = await POST(makePost({ email: 'a@b.co' }) as never);
    expect(res.status).toBe(503);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 500 when the DB write fails', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'db down' } });
    const res = await POST(makePost({ email: 'a@b.co' }) as never);
    expect(res.status).toBe(500);
  });

  it('returns 429 once the per-IP limit is exceeded', async () => {
    const ip = '203.0.113.50';
    const post = (i: number) => makePost({ email: `a${i}@b.co` }, { 'x-forwarded-for': ip });
    // 10 allowed, the 11th is throttled.
    for (let i = 0; i < 10; i++) {
      expect((await POST(post(i) as never)).status).toBe(200);
    }
    const res = await POST(post(99) as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
