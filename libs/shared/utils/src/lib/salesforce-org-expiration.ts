import { addDays } from 'date-fns/addDays';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { endOfDay } from 'date-fns/endOfDay';

/**
 * Salesforce invalidates a partner connected app's refresh token once an org has gone this many days
 * without the token being used. Salesforce owns this cutoff — Jetstream cannot extend it, it can only
 * predict it and warn ahead of time.
 */
export const ORG_INACTIVITY_EXPIRATION_DAYS = 30;

/**
 * Days-before-expiration at which the org owner is emailed. `0` is the notification sent on/after the
 * day the connection dies.
 */
export const ORG_EXPIRATION_NOTIFICATION_DAYS = [7, 1, 0];

/**
 * The window in which the in-app banner and org card badge warn about an upcoming expiration. Matches
 * the first email threshold so the banner and the first email appear at the same time.
 */
export const ORG_EXPIRATION_WARNING_WINDOW_DAYS = ORG_EXPIRATION_NOTIFICATION_DAYS[0];

/**
 * Idle days at which an org enters the warning window and the cron records an expiration date for it.
 */
export const ORG_SCHEDULE_AFTER_IDLE_DAYS = ORG_INACTIVITY_EXPIRATION_DAYS - ORG_EXPIRATION_WARNING_WINDOW_DAYS;

/**
 * Written to `connectionError` when the cron scrubs credentials that Salesforce has already invalidated.
 * Surfaced verbatim to the user on the org card and the org selection screen.
 */
export const ORG_EXPIRATION_CONNECTION_ERROR = `Connection ended by Salesforce after ${ORG_INACTIVITY_EXPIRATION_DAYS} days of inactivity`;

/**
 * The date Salesforce is expected to invalidate an org's refresh token, derived from the last time the
 * org was used through Jetstream.
 *
 * Derived, never granted: Jetstream used to hand out its own grace period on top of an inactivity
 * threshold, which is no longer possible now that Salesforce enforces the lifetime. Normalized to
 * end-of-day so it lines up with the notification thresholds and so recomputing it from an already
 * normalized base is a no-op.
 */
export function computeOrgExpirationDate(activityBaseDate: Date): Date {
  return endOfDay(addDays(activityBaseDate, ORG_INACTIVITY_EXPIRATION_DAYS));
}

/**
 * Compute the next date an org expiration warning is due.
 *
 * Returns the earliest threshold date strictly after `now`, or null once every notification has been
 * sent — null is the terminal state that takes the org out of the cron's notification query entirely.
 * An org whose expiration is already in the past returns null immediately rather than replaying every
 * threshold.
 */
export function computeNextOrgNotificationDate(
  expirationDate: Date,
  now: Date,
  thresholds = ORG_EXPIRATION_NOTIFICATION_DAYS,
): Date | null {
  const upcoming = thresholds
    .map((daysBefore) => endOfDay(addDays(expirationDate, -daysBefore)))
    .filter((notificationDate) => notificationDate > now)
    .sort((a, b) => a.getTime() - b.getTime());

  return upcoming[0] ?? null;
}

/**
 * Calendar days from `now` until the connection expires. Negative once expired, which lets callers
 * distinguish "expires today" (0) from "expired last week" (-7) when choosing wording.
 *
 * Deliberately a calendar-day difference rather than a millisecond delta: every consumer is
 * day-threshold based, and expiration dates are stored at end-of-day, so a raw delta makes the result
 * depend on time-of-day — an org expiring at 23:59 reports 8 ("outside the warning window") when
 * checked at 09:00 seven days earlier.
 */
export function getDaysUntilOrgExpiration(expirationDate: Date, now: Date): number {
  return differenceInCalendarDays(expirationDate, now);
}
