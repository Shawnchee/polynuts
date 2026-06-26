import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase service client before importing the route. `insert` is the
// terminal call we assert on; `from` returns the object that carries it.
type DbResult = { error: { message: string } | null };
const insert = vi.fn(
  (..._args: [Record<string, unknown>, ...unknown[]]): Promise<DbResult> =>
    Promise.resolve({ error: null }),
);
const from = vi.fn((..._args: unknown[]) => ({ insert }));

vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseConfig: vi.fn(() => true),
  getSupabaseService: vi.fn(() => ({ from })),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/feedback/route';
import { hasSupabaseConfig } from '@/lib/supabase/server';
import { resetRateLimit } from '@/lib/rate-limit';

const VALID_ADDR = '0x' + 'a'.repeat(40);

function makePost(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/feedback', () => {
  beforeEach(() => {
    resetRateLimit();
    from.mockClear();
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    vi.mocked(hasSupabaseConfig).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('inserts a valid message and returns 200', async () => {
    const res = await POST(
      makePost({ message: '  great app  ', category: 'idea', wallet_address: VALID_ADDR }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const row = insert.mock.calls[0][0];
    expect(row.message).toBe('great app'); // trimmed
    expect(row.category).toBe('idea');
    expect(row.wallet_address).toBe(VALID_ADDR);
  });

  it('returns 400 for an empty message and writes nothing', async () => {
    const res = await POST(makePost({ message: '   ' }) as never);
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 400 for a message over 2000 chars', async () => {
    const res = await POST(makePost({ message: 'x'.repeat(2001) }) as never);
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('coerces an unknown category to null', async () => {
    await POST(makePost({ message: 'hi', category: 'definitely-not-a-category' }) as never);
    expect(insert.mock.calls[0][0].category).toBeNull();
  });

  it('coerces a malformed wallet to null (does not reject feedback)', async () => {
    const res = await POST(makePost({ message: 'hi', wallet_address: '0x123' }) as never);
    expect(res.status).toBe(200);
    expect(insert.mock.calls[0][0].wallet_address).toBeNull();
  });

  it('reads user-agent from the request header, not the client body', async () => {
    await POST(makePost({ message: 'hi' }, { 'user-agent': 'TestAgent/1.0' }) as never);
    expect(insert.mock.calls[0][0].user_agent).toBe('TestAgent/1.0');
  });

  it('returns 503 when Supabase is not configured', async () => {
    vi.mocked(hasSupabaseConfig).mockReturnValue(false);
    const res = await POST(makePost({ message: 'hi' }) as never);
    expect(res.status).toBe(503);
  });

  it('returns 500 when the DB write fails', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'db down' } });
    const res = await POST(makePost({ message: 'hi' }) as never);
    expect(res.status).toBe(500);
  });

  it('returns 429 once the per-IP limit is exceeded', async () => {
    const ip = '203.0.113.60';
    const post = () => makePost({ message: 'hi' }, { 'x-forwarded-for': ip });
    // 10 allowed, the 11th is throttled.
    for (let i = 0; i < 10; i++) {
      expect((await POST(post() as never)).status).toBe(200);
    }
    const res = await POST(post() as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
