import type { Providers } from '@jetstream/auth/types';

export function parseQueryString<T>(queryString): T {
  const query = {};
  const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query as T;
}

const loginMethodLocalStorageKeys = {
  lastUsedLogin: 'jetstream-last-auth-method',
  rememberedEmail: 'jetstream-remember-me-email',
  ssoAvailable: 'jetstream-sso-available',
};

export function getLastUsedLoginMethod() {
  try {
    return {
      lastUsedLogin: localStorage.getItem(loginMethodLocalStorageKeys.lastUsedLogin) as keyof Providers | null,
      rememberedEmail: localStorage.getItem(loginMethodLocalStorageKeys.rememberedEmail),
      ssoAvailable: localStorage.getItem(loginMethodLocalStorageKeys.ssoAvailable) === 'true',
    };
  } catch {
    return {
      lastUsedLogin: null,
      rememberedEmail: null,
      ssoAvailable: false,
    };
  }
}

export function setLastUsedLoginMethod({
  lastUsedLogin = null,
  rememberedEmail = null,
  ssoAvailable = false,
}: {
  lastUsedLogin?: keyof Providers | 'sso' | null;
  rememberedEmail?: string | null;
  ssoAvailable?: boolean;
} = {}) {
  try {
    // It is intentional that null and undefined both clear the value
    if (lastUsedLogin) {
      localStorage.setItem(loginMethodLocalStorageKeys.lastUsedLogin, lastUsedLogin);
    } else {
      localStorage.removeItem(loginMethodLocalStorageKeys.lastUsedLogin);
    }
    if (rememberedEmail) {
      localStorage.setItem(loginMethodLocalStorageKeys.rememberedEmail, rememberedEmail);
    } else {
      localStorage.removeItem(loginMethodLocalStorageKeys.rememberedEmail);
    }
    if (ssoAvailable) {
      localStorage.setItem(loginMethodLocalStorageKeys.ssoAvailable, 'true');
    } else {
      localStorage.removeItem(loginMethodLocalStorageKeys.ssoAvailable);
    }
  } catch {
    // Ignore
  }
}
