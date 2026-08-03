import { describe, expect, it } from 'vitest';
import {
  computeNextOrgNotificationDate,
  computeOrgExpirationDate,
  getDaysUntilOrgExpiration,
  ORG_EXPIRATION_NOTIFICATION_DAYS,
  ORG_INACTIVITY_EXPIRATION_DAYS,
  ORG_SCHEDULE_AFTER_IDLE_DAYS,
} from '../salesforce-org-expiration';

/**
 * Expiration dates resolve to end-of-day in the server's local timezone (matching the cron), so every
 * date here is constructed and asserted in local time to keep the suite timezone-independent.
 */
function localDate(year: number, month: number, day: number, hour = 0) {
  return new Date(year, month - 1, day, hour);
}

/** The cron normalizes `now` to end-of-day before computing thresholds — mirror that here. */
function localEndOfDay(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function toDateString(date: Date | null) {
  if (!date) {
    return null;
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('constants', () => {
  it('warns far enough ahead that the first email lands inside the Salesforce window', () => {
    expect(ORG_SCHEDULE_AFTER_IDLE_DAYS).toBe(23);
    expect(ORG_SCHEDULE_AFTER_IDLE_DAYS + ORG_EXPIRATION_NOTIFICATION_DAYS[0]).toBe(ORG_INACTIVITY_EXPIRATION_DAYS);
  });
});

describe('computeOrgExpirationDate', () => {
  it('derives the expiration 30 days after the last activity', () => {
    expect(toDateString(computeOrgExpirationDate(localDate(2026, 6, 1, 9)))).toBe('2026-07-01');
  });

  it('normalizes to end of day so the time of the last activity does not shift the date', () => {
    const earlyMorning = computeOrgExpirationDate(localDate(2026, 6, 1, 0));
    const lateNight = computeOrgExpirationDate(localDate(2026, 6, 1, 23));
    expect(earlyMorning.getTime()).toBe(lateNight.getTime());
  });

  it('is idempotent when recomputed from an already normalized base', () => {
    // The cron pins lastActivityAt to endOfDay(base), then re-derives from it on later runs.
    const base = localDate(2026, 6, 1, 9);
    const fromRawBase = computeOrgExpirationDate(base);
    const fromPinnedBase = computeOrgExpirationDate(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999));
    expect(fromPinnedBase.getTime()).toBe(fromRawBase.getTime());
  });
});

describe('computeNextOrgNotificationDate', () => {
  const EXPIRES_AT = computeOrgExpirationDate(localDate(2026, 6, 1));

  it('returns the 7 day threshold when the org just entered the warning window', () => {
    expect(toDateString(computeNextOrgNotificationDate(EXPIRES_AT, localDate(2026, 6, 20)))).toBe('2026-06-24');
  });

  it('skips thresholds that have already passed', () => {
    expect(toDateString(computeNextOrgNotificationDate(EXPIRES_AT, localDate(2026, 6, 26)))).toBe('2026-06-30');
  });

  it('returns the expiration-day threshold as the final notification', () => {
    expect(toDateString(computeNextOrgNotificationDate(EXPIRES_AT, localEndOfDay(2026, 6, 30)))).toBe('2026-07-01');
  });

  it('returns null once every threshold has passed so the org leaves the cron query', () => {
    expect(computeNextOrgNotificationDate(EXPIRES_AT, localEndOfDay(2026, 7, 1))).toBeNull();
  });

  it('returns null for a long-overdue org rather than replaying every threshold', () => {
    // The realignment path derives expiration dates far in the past for orgs idle for months.
    expect(computeNextOrgNotificationDate(computeOrgExpirationDate(localDate(2025, 1, 1)), localDate(2026, 7, 1))).toBeNull();
  });

  it('advances through every configured threshold exactly once', () => {
    let now = localDate(2026, 6, 20);
    const scheduled: string[] = [];

    let next = computeNextOrgNotificationDate(EXPIRES_AT, now);
    while (next) {
      scheduled.push(toDateString(next) as string);
      // Simulate the cron running at the moment the notification came due
      now = next;
      next = computeNextOrgNotificationDate(EXPIRES_AT, now);
    }

    expect(scheduled).toEqual(['2026-06-24', '2026-06-30', '2026-07-01']);
    expect(scheduled).toHaveLength(ORG_EXPIRATION_NOTIFICATION_DAYS.length);
  });
});

describe('getDaysUntilOrgExpiration', () => {
  const EXPIRES_AT = computeOrgExpirationDate(localDate(2026, 6, 1));

  it('does not depend on the time of day it is evaluated', () => {
    // The banner passes a live `new Date()`; a millisecond delta would report 8 in the morning
    // and 7 in the evening for the same calendar day.
    expect(getDaysUntilOrgExpiration(EXPIRES_AT, localDate(2026, 6, 24, 0))).toBe(7);
    expect(getDaysUntilOrgExpiration(EXPIRES_AT, localDate(2026, 6, 24, 23))).toBe(7);
  });

  it('returns 0 on the day the connection expires', () => {
    expect(getDaysUntilOrgExpiration(EXPIRES_AT, localDate(2026, 7, 1, 8))).toBe(0);
  });

  it('goes negative once expired', () => {
    expect(getDaysUntilOrgExpiration(EXPIRES_AT, localDate(2026, 7, 8))).toBe(-7);
  });
});
