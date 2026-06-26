import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const SECRET = 'preview-secret-xyz';

function req(
  path: string,
  opts: { country?: string; cookie?: string; host?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.country) headers['x-vercel-ip-country'] = opts.country;
  if (opts.cookie) headers['cookie'] = opts.cookie;
  if (opts.host) headers['host'] = opts.host;
  return new NextRequest(`http://localhost${path}`, { headers });
}

const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite');
const isNext = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy launch gate', () => {
  beforeEach(() => {
    process.env.LAUNCH_PREVIEW_SECRET = SECRET;
    delete process.env.LAUNCH_MODE;
    delete process.env.BLOCKED_COUNTRIES;
  });
  afterEach(() => {
    delete process.env.LAUNCH_MODE;
    delete process.env.LAUNCH_PREVIEW_SECRET;
  });

  it('open mode: app is reachable (no rewrite to /waitlist)', () => {
    const res = proxy(req('/markets'));
    expect(isNext(res)).toBe(true);
    expect(rewrite(res)).toBeNull();
  });

  it('prelaunch: landing and app routes are rewritten to /waitlist', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    for (const p of ['/', '/markets', '/portfolio', '/leaderboard']) {
      expect(rewrite(proxy(req(p)))?.endsWith('/waitlist')).toBe(true);
    }
  });

  it('prelaunch: /waitlist, /admin, /api and assets stay reachable', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    expect(isNext(proxy(req('/waitlist')))).toBe(true);
    expect(isNext(proxy(req('/admin')))).toBe(true);
    expect(isNext(proxy(req('/api/waitlist')))).toBe(true);
    expect(isNext(proxy(req('/medals/gold.png')))).toBe(true);
  });

  it('prelaunch: a valid preview cookie bypasses the gate', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    const res = proxy(req('/markets', { cookie: `pn_preview=${SECRET}` }));
    expect(isNext(res)).toBe(true);
    expect(rewrite(res)).toBeNull();
  });

  it('prelaunch: a wrong preview cookie does NOT bypass', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    const res = proxy(req('/markets', { cookie: 'pn_preview=nope' }));
    expect(rewrite(res)?.endsWith('/waitlist')).toBe(true);
  });

  it('prelaunch: ?preview=<secret> sets the bypass cookie and strips the param', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    const res = proxy(req(`/?preview=${SECRET}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).not.toContain('preview=');
    const cookie = res.cookies.get('pn_preview');
    expect(cookie?.value).toBe(SECRET);
    expect(cookie?.httpOnly).toBe(true);
  });

  it('prelaunch: ?preview=<wrong> clears any bypass cookie', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    const res = proxy(req('/?preview=wrong'));
    expect(res.status).toBe(307);
    expect(res.cookies.get('pn_preview')?.value).toBe('');
  });

  it('geo-block still wins, even in open mode', () => {
    const res = proxy(req('/markets', { country: 'US' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/not-available');
  });

  it('geo-block applies before the launch gate', () => {
    process.env.LAUNCH_MODE = 'waitlist';
    const res = proxy(req('/', { country: 'US' }));
    expect(res.headers.get('location')).toContain('/not-available');
  });
});
