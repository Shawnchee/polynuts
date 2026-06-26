import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/login/route';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin/auth';
import { resetRateLimit } from '@/lib/rate-limit';

const PW = 'super-secret-admin-pw';

function makePost(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    resetRateLimit();
    process.env.ADMIN_PASSWORD = PW;
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it('sets a valid session cookie on the correct password', async () => {
    const res = await POST(makePost({ password: PW }, { 'x-forwarded-for': '1.1.1.1' }) as never);
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(ADMIN_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(verifyAdminToken(cookie!.value)).toBe(true);
  });

  it('returns 401 and sets no cookie on a wrong password', async () => {
    const res = await POST(makePost({ password: 'nope' }, { 'x-forwarded-for': '2.2.2.2' }) as never);
    expect(res.status).toBe(401);
    expect(res.cookies.get(ADMIN_COOKIE)?.value).toBeFalsy();
  });

  it('returns 401 when no password field is sent', async () => {
    const res = await POST(makePost({}, { 'x-forwarded-for': '3.3.3.3' }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 503 when ADMIN_PASSWORD is not configured', async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await POST(makePost({ password: PW }, { 'x-forwarded-for': '4.4.4.4' }) as never);
    expect(res.status).toBe(503);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makePost('not json', { 'x-forwarded-for': '5.5.5.5' }) as never);
    expect(res.status).toBe(400);
  });

  it('rate-limits repeated attempts from one IP', async () => {
    const ip = '203.0.113.77';
    // 8 allowed, the 9th is throttled — wrong passwords still consume the bucket.
    for (let i = 0; i < 8; i++) {
      const r = await POST(makePost({ password: 'x' }, { 'x-forwarded-for': ip }) as never);
      expect(r.status).toBe(401);
    }
    const throttled = await POST(makePost({ password: PW }, { 'x-forwarded-for': ip }) as never);
    expect(throttled.status).toBe(429);
  });
});
