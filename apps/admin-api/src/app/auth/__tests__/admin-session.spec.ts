import type { Request, Response } from 'express';
import {
  OAUTH_STATE_COOKIE_NAME,
  readOauthStateCookie,
  readSessionCookie,
  SESSION_COOKIE_NAME,
  setOauthStateCookie,
  setSessionCookie,
} from '../admin-session';

vi.mock('../../config/admin-env.config', () => ({
  ADMIN_ENV: {
    ADMIN_SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    ADMIN_SESSION_HOURS: 12,
    useSecureCookies: true,
  },
}));

const adminUser = { email: 'austin@getjetstream.app', name: 'Austin', picture: null };

function createResponseRecorder() {
  const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookies[name] = { value, options };
    },
  } as unknown as Response;
  return { res, cookies };
}

function createRequest(cookies: Record<string, string>) {
  return { cookies } as unknown as Request;
}

describe('admin session cookie', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses __Host- cookies that are HttpOnly, Secure and SameSite=Strict', async () => {
    const { res, cookies } = createResponseRecorder();
    await setSessionCookie(res, adminUser);

    expect(SESSION_COOKIE_NAME).toBe('__Host-jetstream-admin-session');
    expect(cookies[SESSION_COOKIE_NAME].options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  });

  it('round-trips the session and does not expose it in plain text', async () => {
    const { res, cookies } = createResponseRecorder();
    await setSessionCookie(res, adminUser);
    const token = cookies[SESSION_COOKIE_NAME].value;

    expect(token).not.toContain('austin');
    await expect(readSessionCookie(createRequest({ [SESSION_COOKIE_NAME]: token }))).resolves.toEqual(adminUser);
  });

  it('rejects a tampered token', async () => {
    const { res, cookies } = createResponseRecorder();
    await setSessionCookie(res, adminUser);
    const token = cookies[SESSION_COOKIE_NAME].value;
    const tamperedToken = `${token.slice(0, -4)}AAAA`;

    await expect(readSessionCookie(createRequest({ [SESSION_COOKIE_NAME]: tamperedToken }))).resolves.toBeNull();
  });

  it('rejects an expired session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { res, cookies } = createResponseRecorder();
    await setSessionCookie(res, adminUser);
    const token = cookies[SESSION_COOKIE_NAME].value;

    vi.setSystemTime(new Date('2026-01-01T12:00:01Z'));
    await expect(readSessionCookie(createRequest({ [SESSION_COOKIE_NAME]: token }))).resolves.toBeNull();
  });

  it('does not accept an OAuth state token as a session', async () => {
    const { res, cookies } = createResponseRecorder();
    await setOauthStateCookie(res, { state: 'state', nonce: 'nonce', codeVerifier: 'verifier', returnTo: '/' });
    const stateToken = cookies[OAUTH_STATE_COOKIE_NAME].value;

    expect(cookies[OAUTH_STATE_COOKIE_NAME].options).toMatchObject({ sameSite: 'lax' });
    await expect(readOauthStateCookie(createRequest({ [OAUTH_STATE_COOKIE_NAME]: stateToken }))).resolves.toMatchObject({ state: 'state' });
    await expect(readSessionCookie(createRequest({ [SESSION_COOKIE_NAME]: stateToken }))).resolves.toBeNull();
  });

  it('returns null when there is no cookie', async () => {
    await expect(readSessionCookie(createRequest({}))).resolves.toBeNull();
  });
});
