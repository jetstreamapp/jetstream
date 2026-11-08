import { generateHMACDoubleCSRFToken, isHMACDoubleCSRFTokenValidForSession } from '@jetstream/auth/server';
import { CSRF_TOKEN_INVALID_ERROR_TYPE } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrIssueDoubleCSRFToken, validateDoubleCSRF } from '../route.middleware';

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

function makeReq({ cookieToken, headerToken, method = 'POST' }: { cookieToken?: string; headerToken?: string; method?: string }) {
  return {
    method,
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

  it('rejects a mutation that arrives without a cookie, without issuing one', () => {
    const { next, res, issuedToken } = runMiddleware(makeReq({}));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: true, message: 'Invalid CSRF token', errorType: CSRF_TOKEN_INVALID_ERROR_TYPE });
    expect(issuedToken).toBeUndefined();
  });

  it('rejects a mutation that sends a header but no cookie', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { next, res } = runMiddleware(makeReq({ headerToken: token }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // Issuing on every request would give concurrent requests different tokens; only the token endpoint issues them
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets a %s request through without touching the cookie', (method) => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);
    const otherToken = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const withoutCookie = runMiddleware(makeReq({ method }));
    const withMismatchedHeader = runMiddleware(makeReq({ method, cookieToken: token, headerToken: otherToken }));

    for (const { next, res, issuedToken } of [withoutCookie, withMismatchedHeader]) {
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect(issuedToken).toBeUndefined();
    }
  });

  // The browser held on to (or restored) a cookie from an earlier login, and sends it in both places
  it('rejects a token issued for another session', () => {
    const staleToken = generateHMACDoubleCSRFToken(SESSION_SECRET, 'previous-session-id');

    const { next, res, issuedToken } = runMiddleware(makeReq({ cookieToken: staleToken, headerToken: staleToken }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(issuedToken).toBeUndefined();
  });

  it('rejects a token signed with a previous secret', () => {
    const tokenFromOldSecret = generateHMACDoubleCSRFToken('previous-secret', SESSION_ID);

    const { res } = runMiddleware(makeReq({ cookieToken: tokenFromOldSecret, headerToken: tokenFromOldSecret }));

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a header that does not match the cookie', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);
    const otherToken = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { next, res } = runMiddleware(makeReq({ cookieToken: token, headerToken: otherToken }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('accepts the token from the body of a plain form post', () => {
    const token = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);
    const req = makeReq({ cookieToken: token });
    req.body = { [HTTP.BODY.CSRF_TOKEN]: token };

    const { next } = runMiddleware(req);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe('getOrIssueDoubleCSRFToken', () => {
  function getToken(cookieToken?: string) {
    const res = makeRes();
    const token = getOrIssueDoubleCSRFToken(makeReq({ method: 'GET', cookieToken }), res as unknown as express.Response);
    const issuedToken: string | undefined = res.cookie.mock.calls.find(([name]) => name === CSRF_COOKIE_NAME)?.[1];
    return { token, issuedToken, res };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Every tab and every concurrent request has to end up with the same value as the cookie
  it('returns the existing cookie without replacing it when it was issued for the session', () => {
    const cookieToken = generateHMACDoubleCSRFToken(SESSION_SECRET, SESSION_ID);

    const { token, issuedToken } = getToken(cookieToken);

    expect(token).toBe(cookieToken);
    expect(issuedToken).toBeUndefined();
  });

  it('issues an HttpOnly cookie when the browser has none', () => {
    const { token, issuedToken, res } = getToken();

    expect(issuedToken).toBe(token);
    expect(isHMACDoubleCSRFTokenValidForSession(SESSION_SECRET, token, SESSION_ID)).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, token, expect.objectContaining({ httpOnly: true }));
  });

  it.each([
    ['another session', generateHMACDoubleCSRFToken(SESSION_SECRET, 'previous-session-id')],
    ['a previous secret', generateHMACDoubleCSRFToken('previous-secret', SESSION_ID)],
    ['a malformed value', 'not-a-token'],
  ])('replaces a cookie issued for %s', (_, staleToken) => {
    const { token, issuedToken } = getToken(staleToken);

    expect(token).not.toBe(staleToken);
    expect(issuedToken).toBe(token);
    expect(isHMACDoubleCSRFTokenValidForSession(SESSION_SECRET, token, SESSION_ID)).toBe(true);
  });
});
