import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ADMIN_TTL_MS,
  checkAdminPassword,
  isAdminConfigured,
  signAdminToken,
  verifyAdminToken,
} from '@/lib/admin/auth';

const PW = 'correct horse battery staple';

describe('admin auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = PW;
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it('isAdminConfigured reflects whether ADMIN_PASSWORD is set', () => {
    expect(isAdminConfigured()).toBe(true);
    delete process.env.ADMIN_PASSWORD;
    expect(isAdminConfigured()).toBe(false);
    process.env.ADMIN_PASSWORD = '';
    expect(isAdminConfigured()).toBe(false);
  });

  it('checkAdminPassword accepts the exact password only', () => {
    expect(checkAdminPassword(PW)).toBe(true);
    expect(checkAdminPassword(PW + ' ')).toBe(false);
    expect(checkAdminPassword('wrong')).toBe(false);
    expect(checkAdminPassword('')).toBe(false);
  });

  it('checkAdminPassword is false when unconfigured', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkAdminPassword(PW)).toBe(false);
  });

  it('signs and verifies a fresh token', () => {
    const now = 1_700_000_000_000;
    const token = signAdminToken(now);
    expect(token).toBeTruthy();
    expect(verifyAdminToken(token, now + 1000)).toBe(true);
  });

  it('rejects an expired token', () => {
    const now = 1_700_000_000_000;
    const token = signAdminToken(now)!;
    expect(verifyAdminToken(token, now + ADMIN_TTL_MS + 1)).toBe(false);
  });

  it('rejects a tampered expiry (signature no longer matches)', () => {
    const now = 1_700_000_000_000;
    const token = signAdminToken(now)!;
    const sig = token.slice(token.indexOf('.') + 1);
    const forged = `${now + ADMIN_TTL_MS * 10}.${sig}`;
    expect(verifyAdminToken(forged, now)).toBe(false);
  });

  it('rejects a token signed under a different password (rotation invalidates)', () => {
    const now = 1_700_000_000_000;
    const token = signAdminToken(now)!;
    process.env.ADMIN_PASSWORD = 'a new password';
    expect(verifyAdminToken(token, now + 1000)).toBe(false);
  });

  it('rejects malformed / empty tokens', () => {
    expect(verifyAdminToken(undefined)).toBe(false);
    expect(verifyAdminToken('')).toBe(false);
    expect(verifyAdminToken('no-dot-here')).toBe(false);
    expect(verifyAdminToken('.abc')).toBe(false);
    expect(verifyAdminToken('123.')).toBe(false);
  });

  it('signAdminToken returns null when unconfigured', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(signAdminToken()).toBeNull();
  });
});
