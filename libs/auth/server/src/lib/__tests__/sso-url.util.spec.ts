import { afterEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({ USE_SECURE_COOKIES: true }));

vi.mock('@jetstream/api-config', () => ({ ENV: envMock }));

const { assertAllowedIdpUrl, isAllowedIdpUrl, isHttpUrl } = await import('../sso-url.util');

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('https://idp.example.com/sso')).toBe(true);
    expect(isHttpUrl('http://localhost:4000/sso')).toBe(true);
  });

  it.each(['javascript:alert(1)//', 'data:text/html,hello', 'file:///etc/hosts', 'not a url', '', null, undefined])(
    'rejects %j',
    (value) => {
      expect(isHttpUrl(value)).toBe(false);
    },
  );
});

describe('isAllowedIdpUrl', () => {
  afterEach(() => {
    envMock.USE_SECURE_COOKIES = true;
  });

  it('requires https when secure cookies are on', () => {
    expect(isAllowedIdpUrl('https://idp.example.com/sso')).toBe(true);
    expect(isAllowedIdpUrl('http://idp.example.com/sso')).toBe(false);
    expect(isAllowedIdpUrl('javascript:alert(1)//')).toBe(false);
  });

  it('also allows http in local development and CI', () => {
    envMock.USE_SECURE_COOKIES = false;
    expect(isAllowedIdpUrl('http://localhost:4000/api/saml/sso')).toBe(true);
    expect(isAllowedIdpUrl('javascript:alert(1)//')).toBe(false);
  });
});

describe('assertAllowedIdpUrl', () => {
  it('returns an allowed URL and names the setting when it throws', () => {
    expect(assertAllowedIdpUrl('https://idp.example.com/auth', 'The OIDC authorization endpoint')).toBe('https://idp.example.com/auth');
    expect(() => assertAllowedIdpUrl('http://idp.example.com/auth', 'The OIDC authorization endpoint')).toThrow(
      'The OIDC authorization endpoint must be an https URL',
    );
    expect(() => assertAllowedIdpUrl(undefined, 'The OIDC authorization endpoint')).toThrow();
  });
});
