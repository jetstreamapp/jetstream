import type { NextFunction, Request, Response } from 'express';
import { readSessionCookie } from '../admin-session';
import { requireAdminRequestHeader, requireAdminSession } from '../auth.middleware';

vi.mock('@jetstream/api-config', () => ({ enrichRequestContext: vi.fn() }));

vi.mock('../../config/admin-env.config', () => ({
  ADMIN_ENV: {
    ADMIN_BASE_URL: 'https://admin.getjetstream.app',
    allowedEmails: new Set(['austin@getjetstream.app']),
  },
}));

vi.mock('../admin-session', () => ({
  readSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

function createRequest({ method = 'GET', headers = {} }: { method?: string; headers?: Record<string, string> }) {
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { method, get: (name: string) => normalizedHeaders[name.toLowerCase()] } as unknown as Request;
}

function createResponse() {
  const res = { locals: {} as Record<string, unknown>, statusCode: 200 } as unknown as Response & { statusCode: number };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['status'];
  res.json = vi.fn(() => res) as unknown as Response['json'];
  return res;
}

describe('requireAdminRequestHeader', () => {
  it('lets safe methods through without the header', () => {
    const next = vi.fn() as NextFunction;
    requireAdminRequestHeader(createRequest({ method: 'GET' }), createResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a write without the custom header', () => {
    const next = vi.fn() as NextFunction;
    const res = createResponse();
    requireAdminRequestHeader(createRequest({ method: 'POST' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('rejects a write from another origin even with the header', () => {
    const next = vi.fn() as NextFunction;
    const res = createResponse();
    const req = createRequest({ method: 'POST', headers: { 'X-Admin-Request': '1', Origin: 'https://evil.com' } });
    requireAdminRequestHeader(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('accepts a same-origin write with the header', () => {
    const next = vi.fn() as NextFunction;
    const req = createRequest({ method: 'DELETE', headers: { 'X-Admin-Request': '1', Origin: 'https://admin.getjetstream.app' } });
    requireAdminRequestHeader(req, createResponse(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdminSession', () => {
  it('rejects a request without a session', async () => {
    vi.mocked(readSessionCookie).mockResolvedValue(null);
    const next = vi.fn() as NextFunction;
    const res = createResponse();
    await requireAdminSession(createRequest({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a valid session whose email was removed from the allowlist', async () => {
    vi.mocked(readSessionCookie).mockResolvedValue({ email: 'former@getjetstream.app', name: null, picture: null });
    const next = vi.fn() as NextFunction;
    const res = createResponse();
    await requireAdminSession(createRequest({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('attaches the admin to the response for an allowlisted session', async () => {
    const admin = { email: 'austin@getjetstream.app', name: 'Austin', picture: null };
    vi.mocked(readSessionCookie).mockResolvedValue(admin);
    const next = vi.fn() as NextFunction;
    const res = createResponse();
    await requireAdminSession(createRequest({}), res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.admin).toEqual(admin);
  });
});
