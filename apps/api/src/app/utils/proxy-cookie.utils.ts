import { ENV } from '@jetstream/api-config';

const COOKIE_PATH_ATTR = /^path=/i;
const COOKIE_SAMESITE_ATTR = /^samesite=/i;
const COOKIE_SECURE_ATTR = /^secure$/i;

function shouldUseSecureProxyCookies() {
  return ENV.USE_SECURE_COOKIES || ENV.JETSTREAM_SERVER_URL.startsWith('https://');
}

export function normalizePlatformEventSetCookie(cookie: string) {
  const [nameValue, ...attributes] = cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!nameValue) {
    return cookie;
  }

  const normalizedAttributes = attributes.filter(
    (attribute) => !COOKIE_PATH_ATTR.test(attribute) && !COOKIE_SAMESITE_ATTR.test(attribute) && !COOKIE_SECURE_ATTR.test(attribute),
  );

  normalizedAttributes.push('Path=/platform-event');
  if (shouldUseSecureProxyCookies()) {
    normalizedAttributes.push('Secure');
  }
  normalizedAttributes.push('SameSite=Lax');

  return [nameValue, ...normalizedAttributes].join('; ');
}
