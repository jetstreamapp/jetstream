/**
 * Cookie consent storage utilities
 * Stores consent preferences in a cookie (not localStorage) for:
 * - Cross-subdomain support
 * - Built-in expiration (GDPR requires re-prompting periodically)
 * - Standard compliance pattern
 */

import { escapeRegExp } from 'lodash';

const COOKIE_NAME = 'jetstream-cookie-consent';
const COOKIE_MAX_AGE_DAYS = 365;

export type ConsentValue = 'accepted' | 'rejected' | null;

export interface ConsentPreferences {
  analytics: ConsentValue;
  timestamp: number;
}

export interface CookieOptions {
  /**
   * Domain for the cookie (e.g., '.getjetstream.app' for cross-subdomain)
   * Defaults to current domain
   */
  domain?: string;

  /**
   * Max age in days (defaults to 365)
   */
  maxAgeDays?: number;
}

function getCookie(name: string): string | null {
  const escapedName = escapeRegExp(name);
  const match = document.cookie.match(new RegExp(`(^| )${escapedName}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const maxAgeDays = options.maxAgeDays ?? COOKIE_MAX_AGE_DAYS;
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;

  let cookieString = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax; Secure`;

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  document.cookie = cookieString;
}

function deleteCookie(name: string, options: CookieOptions = {}): void {
  let cookieString = `${name}=; max-age=0; path=/`;

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  document.cookie = cookieString;
}

export function getStoredConsent(): ConsentPreferences | null {
  try {
    const stored = getCookie(COOKIE_NAME);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    // Validate structure
    if (parsed && typeof parsed.analytics === 'string' && typeof parsed.timestamp === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredConsent(analytics: ConsentValue, options?: CookieOptions): void {
  try {
    const preferences: ConsentPreferences = {
      analytics,
      timestamp: Date.now(),
    };
    setCookie(COOKIE_NAME, JSON.stringify(preferences), options);
  } catch {
    // Cookie setting might fail
  }
}

export function clearStoredConsent(options?: CookieOptions): void {
  try {
    deleteCookie(COOKIE_NAME, options);
  } catch {
    // Cookie deletion might fail
  }
}
