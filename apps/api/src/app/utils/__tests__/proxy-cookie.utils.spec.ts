import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePlatformEventSetCookie } from '../proxy-cookie.utils';

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
