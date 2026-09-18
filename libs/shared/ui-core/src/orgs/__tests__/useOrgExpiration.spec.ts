import { ORG_INACTIVITY_EXPIRATION_DAYS } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { addDays } from 'date-fns';
import { calculateOrgExpiration, getOrgExpirationBadge, getOrgExpirationLabel } from '../useOrgExpiration';

function buildOrg(overrides: Partial<SalesforceOrgUi> = {}): SalesforceOrgUi {
  return {
    uniqueId: '00D000000000001-005000000000001',
    label: 'john.smith@acme.com',
    username: 'john.smith@acme.com',
    organizationId: '00D000000000001',
    instanceUrl: 'https://acme.my.salesforce.com',
    filterText: '',
    accessToken: '',
    loginUrl: '',
    userId: '005000000000001',
    email: 'john.smith@acme.com',
    displayName: 'John Smith',
    ...overrides,
  } as SalesforceOrgUi;
}

/** An org last used `daysAgo` days ago, i.e. `ORG_INACTIVITY_EXPIRATION_DAYS - daysAgo` days of life left */
function orgLastUsedDaysAgo(daysAgo: number, overrides: Partial<SalesforceOrgUi> = {}) {
  return buildOrg({ lastActivityAt: addDays(new Date(), -daysAgo).toISOString(), ...overrides });
}

describe('calculateOrgExpiration', () => {
  it('treats a recently used org as connected', () => {
    expect(calculateOrgExpiration(orgLastUsedDaysAgo(1)).status).toBe('connected');
  });

  it('treats an org outside the warning window as connected even though it has a deadline', () => {
    const { status, expiryDate } = calculateOrgExpiration(orgLastUsedDaysAgo(10));
    expect(status).toBe('connected');
    expect(expiryDate).not.toBeNull();
  });

  it('warns once the org is inside the warning window', () => {
    const { status, daysUntilExpiration } = calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 5));
    expect(status).toBe('expiring');
    expect(daysUntilExpiration).toBe(5);
  });

  it('reports an org past its deadline as disconnected rather than expiring', () => {
    expect(calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS + 2)).status).toBe('disconnected');
  });

  it('counts the day the connection ends as disconnected, matching when the credentials are scrubbed', () => {
    const { status, daysUntilExpiration } = calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS));
    expect(daysUntilExpiration).toBe(0);
    expect(status).toBe('disconnected');
  });

  it('prefers the disconnected status over an unrelated connection error', () => {
    const org = orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS + 1, { connectionError: 'Something went wrong' });
    expect(calculateOrgExpiration(org).status).toBe('disconnected');
  });

  it('reports a connection error on an otherwise healthy org', () => {
    expect(calculateOrgExpiration(orgLastUsedDaysAgo(1, { connectionError: 'Something went wrong' })).status).toBe('error');
  });

  /**
   * The bug this replaced: the server clears `expirationScheduledFor` as a side effect of using the org
   * but the client cannot see it happen, so a stale value must never outrank fresh activity.
   */
  it('lets recent activity override a stale scheduled expiration date', () => {
    const org = orgLastUsedDaysAgo(0, { expirationScheduledFor: addDays(new Date(), 2).toISOString() });
    expect(calculateOrgExpiration(org).status).toBe('connected');
  });

  it('falls back to the scheduled date for an org with no recorded activity', () => {
    const org = buildOrg({ expirationScheduledFor: addDays(new Date(), 3).toISOString() });
    const { status, daysUntilExpiration } = calculateOrgExpiration(org);
    expect(status).toBe('expiring');
    expect(daysUntilExpiration).toBe(3);
  });

  it('treats an org with neither date as connected', () => {
    expect(calculateOrgExpiration(buildOrg()).status).toBe('connected');
  });
});

describe('expiration badge', () => {
  it('describes an expiring org by how long is left rather than by a date', () => {
    const expiration = calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 2));
    expect(getOrgExpirationLabel(expiration)).toBe('Ends in 2 days');
  });

  it('handles the final day without saying "in 0 days"', () => {
    expect(getOrgExpirationLabel({ status: 'expiring', expiryDate: new Date(), daysUntilExpiration: 0 })).toBe('Ends today');
  });

  it('gives a still-usable org and a dead one different colours and icons', () => {
    const expiring = getOrgExpirationBadge(calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 1)));
    const disconnected = getOrgExpirationBadge(calculateOrgExpiration(orgLastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS + 1)));
    expect(expiring).toEqual({ label: 'Ends in 1 day', icon: 'clock', badgeType: 'warning' });
    expect(disconnected).toEqual({ label: 'Disconnected', icon: 'ban', badgeType: 'error' });
  });

  it('has nothing to show for a healthy org', () => {
    expect(getOrgExpirationBadge(calculateOrgExpiration(orgLastUsedDaysAgo(1)))).toBeNull();
  });
});
