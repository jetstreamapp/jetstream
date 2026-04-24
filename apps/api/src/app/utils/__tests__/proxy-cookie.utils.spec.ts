import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePlatformEventSetCookie, stripJetstreamCookies } from '../proxy-cookie.utils';

const apiConfigMock = vi.hoisted(() => ({
  ENV: {
    JETSTREAM_SERVER_URL: 'https://staging.jetstream-app.com',
    USE_SECURE_COOKIES: false,
  },
}));

vi.mock('@jetstream/api-config', () => apiConfigMock);

describe('normalizePlatformEventSetCookie', () => {
  beforeEach(() => {
    apiConfigMock.ENV.JETSTREAM_SERVER_URL = 'https://staging.jetstream-app.com';
    apiConfigMock.ENV.USE_SECURE_COOKIES = false;
  });

  it('rewrites path and adds explicit Secure/SameSite attributes for HTTPS deployments', () => {
    const cookie = normalizePlatformEventSetCookie('BAYEUX_BROWSER=abc123; Path=/cometd/62.0; SameSite=None');

    expect(cookie).toBe('BAYEUX_BROWSER=abc123; Path=/platform-event; Secure; SameSite=Lax');
  });

  it('preserves unrelated attributes while normalizing security-sensitive ones', () => {
    const cookie = normalizePlatformEventSetCookie('t=value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; Path=/cometd/');

    expect(cookie).toBe('t=value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/platform-event; Secure; SameSite=Lax');
  });

  it('does not add Secure for plain HTTP development', () => {
    apiConfigMock.ENV.JETSTREAM_SERVER_URL = 'http://localhost:3333';

    const cookie = normalizePlatformEventSetCookie('BAYEUX_BROWSER=abc123; Path=/cometd/62.0');

    expect(cookie).toBe('BAYEUX_BROWSER=abc123; Path=/platform-event; SameSite=Lax');
  });
});

describe('stripJetstreamCookies', () => {
  it('returns undefined for empty or missing input', () => {
    expect(stripJetstreamCookies(undefined)).toBeUndefined();
    expect(stripJetstreamCookies('')).toBeUndefined();
  });

  it('strips the session cookie and preserves Salesforce cookies', () => {
    const input = 'sessionid=abc123; BAYEUX_BROWSER=xyz; sid=def';
    expect(stripJetstreamCookies(input)).toBe('BAYEUX_BROWSER=xyz; sid=def');
  });

  it.each([
    ['jetstream-csrf', 'jetstream-csrf=tok; sf=ok', 'sf=ok'],
    ['__Host-jetstream-csrf', '__Host-jetstream-csrf=tok; sf=ok', 'sf=ok'],
    ['__Secure-jetstream-auth.callback-url', '__Secure-jetstream-auth.callback-url=x; sf=ok', 'sf=ok'],
    ['jetstream-auth.pkce.code_verifier', 'jetstream-auth.pkce.code_verifier=x; sf=ok', 'sf=ok'],
    ['jetstream-auth.state', 'jetstream-auth.state=x; sf=ok', 'sf=ok'],
  ])('strips Jetstream namespace cookie: %s', (_label, input, expected) => {
    expect(stripJetstreamCookies(input)).toBe(expected);
  });

  it('strips cookies with underscore separators (regression guard for future naming)', () => {
    // Current cookie names use -/. separators; this test pins the behavior for hypothetical
    // future names like jetstream_session or jetstream_csrf_token so a rename cannot silently
    // reopen the leak.
    expect(stripJetstreamCookies('jetstream_session=abc; sf=ok')).toBe('sf=ok');
    expect(stripJetstreamCookies('jetstream_csrf_token=abc; sf=ok')).toBe('sf=ok');
    expect(stripJetstreamCookies('jetstream=abc; sf=ok')).toBe('sf=ok');
  });

  it('case-insensitive match on the jetstream namespace', () => {
    expect(stripJetstreamCookies('JETSTREAM-csrf=tok; sf=ok')).toBe('sf=ok');
    expect(stripJetstreamCookies('SessionId=tok; sf=ok')).toBe('sf=ok');
  });

  it('does NOT strip unrelated cookies that merely start with jetstream-like substrings', () => {
    // `jetstreamfoo` has no separator and is not in our namespace — leave it alone.
    expect(stripJetstreamCookies('jetstreamfoo=x; sf=ok')).toBe('jetstreamfoo=x; sf=ok');
    expect(stripJetstreamCookies('BAYEUX_BROWSER=abc; sid=def')).toBe('BAYEUX_BROWSER=abc; sid=def');
  });

  it('returns undefined when every cookie was stripped', () => {
    expect(stripJetstreamCookies('sessionid=abc; jetstream-csrf=tok')).toBeUndefined();
  });

  it('preserves raw bytes of Salesforce auth cookies without percent-encoding', () => {
    // Regression guard for CometD 403::Unknown client: the `t` and `sfdc-stream` cookies contain
    // `/`, `+`, `=`, `:`, `!` in their raw values. Re-serializing via encodeURIComponent flips
    // those to %2F/%2B/%3D/%3A and Salesforce rejects the handshake.
    const salesforceT = 't=!0vaFlJER5UsrfIGrfKp9YI2pARkJi5YS8O/yCf8GE+6HiX+CvWWacnC3MzF+OXsuC3USJWIP3jamDQ==';
    const salesforceStream = 'sfdc-stream=!KTsgJv+UCG+cEFgc/VSBe4Ed9n2RCSnIjVh2I1rsjhPUrJQNUHL5S7uaJMBg5Xb1ZjryUeqfG1wHqg==';
    const consent = 'CookieConsentPolicy=0:1';
    const input = [consent, salesforceT, salesforceStream, 'sessionid=abc; jetstream-csrf=tok'].join('; ');

    expect(stripJetstreamCookies(input)).toBe([consent, salesforceT, salesforceStream].join('; '));
  });
});
