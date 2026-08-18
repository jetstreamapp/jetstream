import { beforeEach, describe, expect, it } from 'vitest';
import { getLastUsedLoginMethod, setLastUsedLoginMethod } from '../utils/utils';

const LAST_LOGIN_METHOD_COOKIE = 'jetstream-auth.last-login-method';

function setLastLoginMethodCookie(value: string) {
  document.cookie = `${LAST_LOGIN_METHOD_COOKIE}=${encodeURIComponent(value)}; path=/`;
}

function readLastLoginMethodCookie() {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${LAST_LOGIN_METHOD_COOKIE}=`));
}

describe('auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${LAST_LOGIN_METHOD_COOKIE}=; path=/; max-age=0`;
  });

  it('clears remembered email state when no remembered email is provided', () => {
    setLastUsedLoginMethod({ lastUsedLogin: 'google', rememberedEmail: 'private@example.com', ssoAvailable: true });

    expect(getLastUsedLoginMethod()).toEqual({
      lastUsedLogin: 'google',
      rememberedEmail: 'private@example.com',
      ssoAvailable: true,
    });

    setLastUsedLoginMethod();

    expect(getLastUsedLoginMethod()).toEqual({
      lastUsedLogin: null,
      rememberedEmail: null,
      ssoAvailable: false,
    });
  });

  /**
   * The cookie is written by `setLastLoginMethodCookie` in the API auth controller after an identity
   * provider authenticates the user - these cover the landing half of that cross-app contract.
   */
  describe('last login method cookie', () => {
    it('promotes a successful SSO login into local storage and consumes the cookie', () => {
      setLastLoginMethodCookie(JSON.stringify({ method: 'sso', email: 'sso@example.com' }));

      expect(getLastUsedLoginMethod()).toEqual({
        lastUsedLogin: 'sso',
        rememberedEmail: 'sso@example.com',
        ssoAvailable: true,
      });

      expect(readLastLoginMethodCookie()).toBeUndefined();

      // The promoted values survive on their own now that the cookie is gone
      expect(getLastUsedLoginMethod()).toEqual({
        lastUsedLogin: 'sso',
        rememberedEmail: 'sso@example.com',
        ssoAvailable: true,
      });
    });

    it('overwrites a previously remembered login method', () => {
      setLastUsedLoginMethod({ lastUsedLogin: 'google', rememberedEmail: 'google@example.com' });
      setLastLoginMethodCookie(JSON.stringify({ method: 'sso', email: 'sso@example.com' }));

      expect(getLastUsedLoginMethod()).toEqual({
        lastUsedLogin: 'sso',
        rememberedEmail: 'sso@example.com',
        ssoAvailable: true,
      });
    });

    it.each([
      ['malformed json', 'not-json'],
      ['an unexpected method', JSON.stringify({ method: 'google', email: 'sso@example.com' })],
      ['a missing email', JSON.stringify({ method: 'sso' })],
      ['a non-string email', JSON.stringify({ method: 'sso', email: 123 })],
      ['an empty email', JSON.stringify({ method: 'sso', email: '' })],
    ])('ignores %s but still consumes the cookie', (_label, cookieValue) => {
      setLastLoginMethodCookie(cookieValue);

      expect(getLastUsedLoginMethod()).toEqual({
        lastUsedLogin: null,
        rememberedEmail: null,
        ssoAvailable: false,
      });

      // Consumed either way so a bad value is not re-parsed on every page load
      expect(readLastLoginMethodCookie()).toBeUndefined();
    });

    it('leaves existing local storage alone when no cookie is present', () => {
      setLastUsedLoginMethod({ lastUsedLogin: 'google', rememberedEmail: 'google@example.com' });

      expect(getLastUsedLoginMethod()).toEqual({
        lastUsedLogin: 'google',
        rememberedEmail: 'google@example.com',
        ssoAvailable: false,
      });
    });
  });
});
