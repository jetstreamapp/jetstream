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

/** Login methods that get a "Last Used" indicator on the login form - `sso` is not an entry in `Providers` */
export type LastUsedLoginMethod = keyof Providers | 'sso';

/**
 * Set by the API only after an identity provider has authenticated the user. The login page cannot
 * record a successful SSO login itself because it navigates away to the provider before knowing the
 * outcome, so the marker comes back as a cookie and is promoted to local storage on the next visit.
 * Shape is a contract with `setLastLoginMethodCookie` in the API auth controller.
 */
const LAST_LOGIN_METHOD_COOKIE = 'jetstream-auth.last-login-method';

function consumeLastLoginMethodCookie(): { lastUsedLogin: LastUsedLoginMethod; rememberedEmail: string } | null {
  const rawValue = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LAST_LOGIN_METHOD_COOKIE}=`))
    ?.slice(LAST_LOGIN_METHOD_COOKIE.length + 1);

  if (!rawValue) {
    return null;
  }

  // Consume it either way - a malformed value should not be re-parsed on every page load
  document.cookie = `${LAST_LOGIN_METHOD_COOKIE}=; path=/; max-age=0`;

  try {
    const { method, email } = JSON.parse(decodeURIComponent(rawValue));
    if (method !== 'sso' || typeof email !== 'string' || !email) {
      return null;
    }
    return { lastUsedLogin: 'sso', rememberedEmail: email };
  } catch {
    return null;
  }
}

export function getLastUsedLoginMethod() {
  try {
    const successfulSsoLogin = consumeLastLoginMethodCookie();
    if (successfulSsoLogin) {
      setLastUsedLoginMethod({ ...successfulSsoLogin, ssoAvailable: true });
    }

    return {
      lastUsedLogin: localStorage.getItem(loginMethodLocalStorageKeys.lastUsedLogin) as LastUsedLoginMethod | null,
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
  lastUsedLogin?: LastUsedLoginMethod | null;
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
