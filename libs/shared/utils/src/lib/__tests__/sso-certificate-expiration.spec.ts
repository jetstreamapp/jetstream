import { describe, expect, it } from 'vitest';
import { computeNextCertNotificationDate, getDaysUntilCertExpiration, SSO_CERT_NOTIFICATION_DAYS } from '../sso-certificate-expiration';

/**
 * Thresholds resolve to end-of-day in the server's local timezone (matching the org expiration cron),
 * so every date here is constructed and asserted in local time to keep the suite timezone-independent.
 */
function localDate(year: number, month: number, day: number, hour = 0) {
  return new Date(year, month - 1, day, hour);
}

function toDateString(date: Date | null) {
  if (!date) {
    return null;
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const EXPIRES_AT = localDate(2026, 9, 15, 12);

describe('computeNextCertNotificationDate', () => {
  it('returns the 30 day threshold when the expiration is far out', () => {
    expect(toDateString(computeNextCertNotificationDate(EXPIRES_AT, localDate(2026, 1, 1)))).toBe('2026-08-16');
  });

  it('skips thresholds that have already passed', () => {
    // 20 days out: the 30 day threshold is in the past, so 14 days is next
    expect(toDateString(computeNextCertNotificationDate(EXPIRES_AT, localDate(2026, 8, 26)))).toBe('2026-09-01');
  });

  it('returns the expiration-day threshold as the final notification', () => {
    expect(toDateString(computeNextCertNotificationDate(EXPIRES_AT, localDate(2026, 9, 13)))).toBe('2026-09-15');
  });

  it('returns null once every threshold has passed so the config leaves the cron query', () => {
    expect(computeNextCertNotificationDate(EXPIRES_AT, localDate(2026, 9, 16))).toBeNull();
  });

  it('returns null for an already-expired certificate rather than replaying every threshold', () => {
    expect(computeNextCertNotificationDate(EXPIRES_AT, localDate(2027, 1, 1))).toBeNull();
  });

  it('advances through every configured threshold exactly once', () => {
    let now = localDate(2026, 1, 1);
    const scheduled: string[] = [];

    let next = computeNextCertNotificationDate(EXPIRES_AT, now);
    while (next) {
      scheduled.push(toDateString(next) as string);
      // Simulate the cron running at the moment the notification came due
      now = next;
      next = computeNextCertNotificationDate(EXPIRES_AT, now);
    }

    expect(scheduled).toEqual(['2026-08-16', '2026-09-01', '2026-09-08', '2026-09-12', '2026-09-15']);
    expect(scheduled).toHaveLength(SSO_CERT_NOTIFICATION_DAYS.length);
  });
});

describe('getDaysUntilCertExpiration', () => {
  it('counts whole days remaining', () => {
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 1, 12))).toBe(14);
  });

  it('returns 0 on the expiration date itself', () => {
    expect(getDaysUntilCertExpiration(EXPIRES_AT, EXPIRES_AT)).toBe(0);
  });

  it('goes negative once expired so callers can distinguish "expires today" from "long expired"', () => {
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 22, 12))).toBe(-7);
  });

  it('returns 0 all day on the expiration date, regardless of time of day', () => {
    // A millisecond delta would report 1 here, since the certificate expires later the same morning
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 15, 0))).toBe(0);
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 15, 23))).toBe(0);
  });

  it('is stable across the day rather than shifting with the clock', () => {
    // Same calendar day, different hours: a millisecond delta would straddle 14 and 13 here
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 1, 0))).toBe(14);
    expect(getDaysUntilCertExpiration(EXPIRES_AT, localDate(2026, 9, 1, 23))).toBe(14);
  });
});
