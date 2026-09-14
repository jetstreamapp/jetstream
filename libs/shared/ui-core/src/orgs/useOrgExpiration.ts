import { IconName } from '@jetstream/icon-factory';
import {
  computeOrgExpirationDate,
  getDaysUntilOrgExpiration,
  ORG_EXPIRATION_WARNING_WINDOW_DAYS,
  ORG_INACTIVITY_EXPIRATION_DAYS,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import { BadgeType, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useMemo } from 'react';

/**
 * How an org's connection should be presented, derived in one place so that "will stop working soon"
 * and "has already stopped working" can never render the same way.
 */
export type OrgConnectionStatus =
  /** Usable, and not near enough to the inactivity deadline to be worth mentioning */
  | 'connected'
  /** Still usable, but inside the warning window - using the org resets the clock */
  | 'expiring'
  /** Past the inactivity deadline - Salesforce has ended the connection and the org must be reconnected */
  | 'disconnected'
  /** A connection problem unrelated to inactivity */
  | 'error';

export interface OrgExpirationStatus {
  status: OrgConnectionStatus;
  /** When Salesforce is expected to end - or has already ended - the connection */
  expiryDate: Date | null;
  /** Calendar days until `expiryDate`; zero on the day it ends and negative afterwards */
  daysUntilExpiration: number | null;
}

export interface ExpiringOrgsSummary {
  total: number;
  disconnected: number;
  expiringSoon: number;
}

const CONNECTED: OrgExpirationStatus = { status: 'connected', expiryDate: null, daysUntilExpiration: null };

/**
 * Salesforce ends a connection a fixed number of days after the org was last used, so the deadline is
 * derived from `lastActivityAt` rather than read from `expirationScheduledFor`.
 *
 * The server nulls `expirationScheduledFor` as a side effect of any request made for the org, which
 * the client has no way to observe - relying on it left an org the user had just successfully used
 * looking expired until the org list happened to be re-fetched. `lastActivityAt` is a value the client
 * can honestly maintain itself (see `OrgActivitySync`), so the countdown self-heals on use.
 *
 * `expirationScheduledFor` remains the fallback for orgs with no recorded activity.
 */
function getExpiryDate(org: SalesforceOrgUi): Date | null {
  if (org.lastActivityAt) {
    return computeOrgExpirationDate(new Date(org.lastActivityAt));
  }
  return org.expirationScheduledFor ? new Date(org.expirationScheduledFor) : null;
}

export function calculateOrgExpiration(org: SalesforceOrgUi | null | undefined): OrgExpirationStatus {
  if (!org) {
    return CONNECTED;
  }

  const expiryDate = getExpiryDate(org);
  const daysUntilExpiration = expiryDate ? getDaysUntilOrgExpiration(expiryDate, new Date()) : null;

  /**
   * The deadline is checked before `connectionError` on purpose: an org that has aged out usually also
   * carries an error, and "reconnect this org" is a more useful thing to say than "something went wrong".
   */
  if (daysUntilExpiration !== null && daysUntilExpiration <= 0) {
    return { status: 'disconnected', expiryDate, daysUntilExpiration };
  }
  if (org.connectionError) {
    return { status: 'error', expiryDate, daysUntilExpiration };
  }
  if (daysUntilExpiration !== null && daysUntilExpiration <= ORG_EXPIRATION_WARNING_WINDOW_DAYS) {
    return { status: 'expiring', expiryDate, daysUntilExpiration };
  }
  return { status: 'connected', expiryDate, daysUntilExpiration };
}

/**
 * Short status text for a badge or list item. Deliberately a relative count rather than a date - the
 * whole point of the warning is urgency, and "Ends in 2 days" carries that where "Ends 9/19" does not.
 */
export function getOrgExpirationLabel({ status, daysUntilExpiration }: OrgExpirationStatus): string | null {
  switch (status) {
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Connection error';
    case 'expiring':
      return daysUntilExpiration === 0
        ? 'Ends today'
        : `Ends in ${daysUntilExpiration} ${pluralizeFromNumber('day', daysUntilExpiration ?? 0)}`;
    default:
      return null;
  }
}

export interface OrgExpirationBadge {
  label: string;
  icon: IconName;
  badgeType: BadgeType;
}

/**
 * Everything a badge needs to distinguish the states at a glance. Colour, icon and wording are chosen
 * together in one place so the header, the org list and the org card cannot drift apart - an org that
 * still works is amber with a clock, one that has stopped is red with a ban.
 */
export function getOrgExpirationBadge(expiration: OrgExpirationStatus): OrgExpirationBadge | null {
  const label = getOrgExpirationLabel(expiration);
  if (!label) {
    return null;
  }
  const isStillUsable = expiration.status === 'expiring';
  return { label, icon: isStillUsable ? 'clock' : 'ban', badgeType: isStillUsable ? 'warning' : 'error' };
}

/**
 * Explains the badge and, more importantly, what the user can do about it. Shared so the header, the
 * org list and the org card never drift into describing the same state differently.
 */
export function getOrgExpirationTooltip(
  { status, daysUntilExpiration }: OrgExpirationStatus,
  connectionError?: Maybe<string>,
): string | null {
  switch (status) {
    case 'disconnected':
      return `Salesforce ended this connection because the org was not used in Jetstream for ${ORG_INACTIVITY_EXPIRATION_DAYS} days. Reconnect the org to continue using it, or remove it if you no longer need it.`;
    case 'error':
      return `There was an error connecting to this org. You can try refreshing the connection, otherwise you will need to reconnect the org.${connectionError ? ` Error: ${connectionError}` : ''}`;
    case 'expiring':
      return `The org still works. Salesforce will end this connection in ${daysUntilExpiration} ${pluralizeFromNumber('day', daysUntilExpiration ?? 0)} unless the org is used - opening or refreshing it in Jetstream resets the clock.`;
    default:
      return null;
  }
}

export function useOrgExpiration(org: SalesforceOrgUi | null | undefined): OrgExpirationStatus {
  return useMemo(() => calculateOrgExpiration(org), [org]);
}

/**
 * Counts for the app-home banner. Orgs with an unrelated connection error are excluded - the banner is
 * specifically about the inactivity policy and they have their own messaging on the org card.
 */
export function useExpiringOrgs(orgs: SalesforceOrgUi[]): ExpiringOrgsSummary {
  return useMemo(() => {
    const statuses = orgs.map((org) => calculateOrgExpiration(org).status);
    const disconnected = statuses.filter((status) => status === 'disconnected').length;
    const expiringSoon = statuses.filter((status) => status === 'expiring').length;
    return { total: disconnected + expiringSoon, disconnected, expiringSoon };
  }, [orgs]);
}
