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
};

export function getLastUsedLoginMethod() {
  try {
    return {
      lastUsedLogin: localStorage.getItem(loginMethodLocalStorageKeys.lastUsedLogin) as keyof Providers | null,
      rememberedEmail: localStorage.getItem(loginMethodLocalStorageKeys.rememberedEmail),
    };
  } catch {
    return {
      lastUsedLogin: null,
      rememberedEmail: null,
    };
  }
}

export function setLastUsedLoginMethod({
  lastUsedLogin = null,
  rememberedEmail = null,
}: { lastUsedLogin?: keyof Providers | null; rememberedEmail?: string | null } = {}) {
  try {
    // It is intentional that null and undefined both clear the value
    if (!lastUsedLogin) {
      localStorage.removeItem(loginMethodLocalStorageKeys.lastUsedLogin);
    }
    if (!rememberedEmail) {
      localStorage.removeItem(loginMethodLocalStorageKeys.rememberedEmail);
    }
    if (lastUsedLogin) {
      localStorage.setItem(loginMethodLocalStorageKeys.lastUsedLogin, lastUsedLogin);
    }
    if (rememberedEmail) {
      localStorage.setItem(loginMethodLocalStorageKeys.rememberedEmail, rememberedEmail);
    }
  } catch {
    // Ignore
  }
}
