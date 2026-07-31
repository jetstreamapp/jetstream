import { addDays } from 'date-fns/addDays';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { endOfDay } from 'date-fns/endOfDay';

/**
 * Days-before-expiration at which team admins are emailed about an expiring SAML IdP signing
 * certificate. `0` is the notification sent on/after the expiration date itself.
 *
 * Shared between the API (which seeds the schedule whenever a certificate is saved) and the
 * cron task (which sends and then advances it) so both agree on what "the next reminder" means.
 */
export const SSO_CERT_NOTIFICATION_DAYS = [30, 14, 7, 3, 0];

/**
 * The window in which the in-app banner warns admins about an upcoming expiration. Matches the
 * first email threshold so the banner and the first email appear at the same time.
 */
export const SSO_CERT_WARNING_WINDOW_DAYS = SSO_CERT_NOTIFICATION_DAYS[0];

/**
 * Compute the next date a certificate expiration reminder is due.
 *
 * Returns the earliest threshold date strictly after `now`, or null once every reminder has been
 * sent — null is the terminal state that takes the configuration out of the cron's query entirely.
 */
export function computeNextCertNotificationDate(expiresAt: Date, now: Date, thresholds = SSO_CERT_NOTIFICATION_DAYS): Date | null {
  const upcoming = thresholds
    .map((daysBefore) => endOfDay(addDays(expiresAt, -daysBefore)))
    .filter((notificationDate) => notificationDate > now)
    .sort((a, b) => a.getTime() - b.getTime());

  return upcoming[0] ?? null;
}

/**
 * Calendar days from `now` until the certificate expires. Negative once expired, which lets callers
 * distinguish "expires today" (0) from "expired last week" (-7) when choosing wording.
 *
 * Deliberately a calendar-day difference rather than a millisecond delta: every consumer is
 * day-threshold based, and a raw delta makes the result depend on time-of-day — a certificate
 * expiring at 23:00 would report 1 ("expires tomorrow") when checked at 09:00 that same morning.
 * The cron normalizes `now` to end-of-day so it was unaffected, but the heartbeat banner passes a
 * live `new Date()` and needs this to be exact.
 */
export function getDaysUntilCertExpiration(expiresAt: Date, now: Date): number {
  return differenceInCalendarDays(expiresAt, now);
}
