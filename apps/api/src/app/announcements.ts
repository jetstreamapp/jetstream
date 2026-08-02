import { logger } from '@jetstream/api-config';
import { AuthenticatedUser } from '@jetstream/auth/types';
import { getDaysUntilCertExpiration, getErrorMessageAndStackObj, SSO_CERT_WARNING_WINDOW_DAYS } from '@jetstream/shared/utils';
import { Announcement, Maybe, TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import { LRUCache } from 'lru-cache';
import { getSamlCertificateExpiration } from './db/team.db';

/**
 * The heartbeat endpoint is hit on app load and on every tab focus, so the SSO certificate lookup is
 * cached per team. The TTL only delays how quickly a banner appears or clears after an admin updates
 * the certificate, which is not time-sensitive at day granularity.
 */
const SSO_CERT_CACHE_TTL_MS = 15 * 60 * 1000;

const SSO_SETTINGS_LINK = { key: '{ssoSettings}', label: 'Team Settings → Single Sign-On', to: '/teams' };

const ssoCertExpirationCache = new LRUCache<string, { value: { configId: string; expiresAt: Date } | null }>({
  max: 1000,
  ttl: SSO_CERT_CACHE_TTL_MS,
});

function getStaticAnnouncements(): Announcement[] {
  // This is a placeholder for the announcements that will be stored in the database eventually
  return [
    {
      id: 'auth-downtime-2024-11-15T15:00:00.000Z',
      title: 'Downtime',
      content:
        'We will be upgrading our authentication system with an expected start time of {start} in your local timezone. During this time, you will not be able to log in or use Jetstream. We expect the upgrade to take less than one hour.',
      replacementDates: [{ key: '{start}', value: '2024-11-16T18:00:00.000Z' }],
      expiresAt: '2024-11-16T20:00:00.000Z',
      createdAt: '2024-11-15T15:00:00.000Z',
    },
  ].filter(({ expiresAt }) => new Date(expiresAt) > new Date());
}

/**
 * Warn team admins that their SAML IdP signing certificate is about to expire (or already has).
 *
 * Only admins see this — they are the only role that can update the SSO configuration, so showing it
 * to every member would be unactionable noise. The announcement id embeds the expiration date so that
 * renewing the certificate produces a new id, which re-shows the banner for anyone who had dismissed
 * the previous one and stops re-showing the old one.
 */
async function getSsoCertificateAnnouncement(user: AuthenticatedUser): Promise<Announcement | null> {
  const { teamMembership } = user;
  if (teamMembership?.role !== TEAM_MEMBER_ROLE_ADMIN || teamMembership.status !== TEAM_MEMBER_STATUS_ACTIVE) {
    return null;
  }

  const cached = ssoCertExpirationCache.get(teamMembership.teamId);
  const certificate = cached ? cached.value : await getSamlCertificateExpiration(teamMembership.teamId);
  if (!cached) {
    ssoCertExpirationCache.set(teamMembership.teamId, { value: certificate });
  }

  if (!certificate) {
    return null;
  }

  const now = new Date();
  const daysUntilExpiration = getDaysUntilCertExpiration(certificate.expiresAt, now);
  if (daysUntilExpiration > SSO_CERT_WARNING_WINDOW_DAYS) {
    return null;
  }

  const expirationDate = certificate.expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  // Only negative once the certificate is past its expiration date — on the expiration date itself
  // (0) it is still valid for part of the day, so the banner stays worded as upcoming.
  const hasExpired = daysUntilExpiration < 0;

  return {
    id: `sso-cert-expiration-${certificate.configId}-${certificate.expiresAt.toISOString()}`,
    title: hasExpired ? 'SSO Certificate Expired' : 'SSO Certificate Expiring',
    content: hasExpired
      ? `The SAML signing certificate for your team expired on ${expirationDate}. Once your identity provider rotates to a new certificate, SSO logins will fail. Update it in ${SSO_SETTINGS_LINK.key}.`
      : `The SAML signing certificate for your team expires on ${expirationDate}. Update it in ${SSO_SETTINGS_LINK.key} to avoid SSO login failures.`,
    replacementDates: [],
    link: SSO_SETTINGS_LINK,
    // The banner should stay up until the certificate is replaced, not disappear on a fixed date.
    expiresAt: new Date(now.getTime() + SSO_CERT_CACHE_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  };
}

export async function getAnnouncements(user?: Maybe<AuthenticatedUser>): Promise<Announcement[]> {
  const announcements = getStaticAnnouncements();

  if (user) {
    // Best-effort: a database or cache failure looking up the certificate should not take down the
    // rest of the announcements (or the heartbeat response they are returned on).
    try {
      const ssoCertAnnouncement = await getSsoCertificateAnnouncement(user);
      if (ssoCertAnnouncement) {
        announcements.push(ssoCertAnnouncement);
      }
    } catch (ex) {
      logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Failed to get SSO certificate announcement');
    }
  }

  return announcements;
}

/** Exported for the SSO configuration save path so an updated certificate clears the stale banner. */
export function clearSsoCertificateAnnouncementCache(teamId: string) {
  ssoCertExpirationCache.delete(teamId);
}
