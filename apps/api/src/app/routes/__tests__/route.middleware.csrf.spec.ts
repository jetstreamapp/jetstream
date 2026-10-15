import { generateHMACDoubleCSRFToken, isHMACDoubleCSRFTokenValidForSession } from '@jetstream/auth/server';
import { CSRF_TOKEN_INVALID_ERROR_TYPE } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateDoubleCSRF } from '../route.middleware';

const SESSION_SECRET = 'test-session-secret';
const SESSION_ID = 'current-session-id';
// Secure cookies are off in this mock environment, so the cookie has no `__Host-` prefix
const CSRF_COOKIE_NAME = HTTP.COOKIE.CSRF_SUFFIX;

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('@jetstream/api-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/api-config')>();
  return {
    ...actual,
    ENV: { ...actual.ENV, JETSTREAM_SESSION_SECRET: 'test-session-secret', USE_SECURE_COOKIES: false },
    getLogger: () => logger,
  };
});

function makeReq({ cookieToken, headerToken }: { cookieToken?: string; headerToken?: string }) {
  return {
    method: 'POST',
    path: '/api/query',
    headers: { cookie: cookieToken ? `${CSRF_COOKIE_NAME}=${encodeURIComponent(cookieToken)}` : '' },
    body: {},
    session: { id: SESSION_ID, user: { id: 'user-1' } },
    get: (name: string) => (name.toLowerCase() === HTTP.HEADERS.X_CSRF_TOKEN.toLowerCase() ? headerToken : undefined),
  } as unknown as express.Request;
}

function makeRes() {
  const res = {
    cookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function runMiddleware(req: express.Request) {
  const res = makeRes();
  const next = vi.fn();
  validateDoubleCSRF(req, res as unknown as express.Response, next);
  const issuedToken: string | undefined = res.cookie.mock.calls.find(([name]) => name === CSRF_COOKIE_NAME)?.[1];
  return { res, next, issuedToken };
}

describe('validateDoubleCSRF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a request through when the header matches a cookie issued for the session', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { next, res, issuedToken } = runMiddleware(makeReq({ cookieToken: token, headerToken: token }));

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(issuedToken).toBeUndefined();
  });

  it('issues a cookie and lets the request through when the browser dropped the cookie', () => {
    const { next, issuedToken } = runMiddleware(makeReq({}));

    expect(next).toHaveBeenCalledOnce();
    expect(issuedToken).toBeDefined();
    expect(isHMACDoubleCSRFTokenValidForSession(SESSION_SECRET, issuedToken as string, SESSION_ID)).toBe(true);
  });

  // The browser held on to (or restored) a cookie from an earlier login, and sends it in both places
  it('replaces a cookie issued for another session and rejects the request so the client can resend it', () => {
    const staleToken = generateHMACDoubleCSRFToken(SESSION_SECRET, 'previous-session-id');

    const { next, res, issuedToken } = runMiddleware(makeReq({ cookieToken: staleToken, headerToken: staleToken }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: true, message: 'Invalid CSRF token', errorType: CSRF_TOKEN_INVALID_ERROR_TYPE });
    expect(isHMACDoubleCSRFTokenValidForSession(SESSION_SECRET, issuedToken as string, SESSION_ID)).toBe(true);
  });

  it('replaces a cookie signed with a previous secret', () => {
    const tokenFromOldSecret = generateHMACDoubleCSRFToken('previous-secret', SESSION_ID);

    const { res, issuedToken } = runMiddleware(makeReq({ cookieToken: tokenFromOldSecret, headerToken: tokenFromOldSecret }));

    expect(res.status).toHaveBeenCalledWith(403);
    expect(isHMACDoubleCSRFTokenValidForSession(SESSION_SECRET, issuedToken as string, SESSION_ID)).toBe(true);
  });

  // Replacing a valid cookie would fail every other request already in flight with the current value
  it('keeps a valid cookie when the request is missing the header', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { next, res, issuedToken } = runMiddleware(makeReq({ cookieToken: token }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorType: CSRF_TOKEN_INVALID_ERROR_TYPE }));
    expect(issuedToken).toBeUndefined();
  });

  it('keeps a valid cookie when the header does not match it', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);
    const otherToken = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { next, issuedToken } = runMiddleware(makeReq({ cookieToken: token, headerToken: otherToken }));

    expect(next).not.toHaveBeenCalled();
    expect(issuedToken).toBeUndefined();
  });
});
