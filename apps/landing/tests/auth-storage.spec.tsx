import { beforeEach, describe, expect, it } from 'vitest';
import { getLastUsedLoginMethod, setLastUsedLoginMethod } from '../utils/utils';

describe('auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
