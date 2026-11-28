import type { SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  findConnectedOrg,
  generatePassword,
  getDaysRemaining,
  getDisplayStatus,
  getExpirationLabel,
  getSignupErrorMessage,
  getUserAlias,
  isCreatedWithJetstream,
  toScratchOrgRows,
} from '../scratch-org.utils';

// Local time, the same as the date-only expiration dates are read in, so the tests pass in every timezone
const NOW = new Date(2026, 10, 27, 12);

function buildOrg(overrides: Partial<SalesforceOrgUi>): SalesforceOrgUi {
  return {
    uniqueId: 'org-1',
    organizationId: '00D000000000001AAA',
    username: 'test-abc@example.com',
    userId: '005000000000001AAA',
    ...overrides,
  } as SalesforceOrgUi;
}

describe('getDaysRemaining', () => {
  it('counts whole calendar days', () => {
    expect(getDaysRemaining('2026-11-30', NOW)).toBe(3);
    expect(getDaysRemaining('2026-11-27', NOW)).toBe(0);
    expect(getDaysRemaining('2026-11-25', NOW)).toBe(-2);
  });

  it('returns null without a usable date', () => {
    expect(getDaysRemaining(null, NOW)).toBeNull();
    expect(getDaysRemaining('not a date', NOW)).toBeNull();
  });
});

describe('getDisplayStatus', () => {
  it.each([
    ['New', 'Creating'],
    ['Creating', 'Creating'],
    ['Error', 'Error'],
    ['Deleted', 'Deleted'],
  ] as const)('shows %s as %s', (Status, expected) => {
    expect(getDisplayStatus({ Id: '1', Status }, NOW)).toBe(expected);
  });

  it('shows an active scratch org past its expiration date as expired', () => {
    expect(getDisplayStatus({ Id: '1', Status: 'Active', ExpirationDate: '2026-11-28' }, NOW)).toBe('Active');
    expect(getDisplayStatus({ Id: '1', Status: 'Active', ExpirationDate: '2026-11-27' }, NOW)).toBe('Active');
    expect(getDisplayStatus({ Id: '1', Status: 'Active', ExpirationDate: '2026-11-26' }, NOW)).toBe('Expired');
  });
});

describe('getExpirationLabel', () => {
  it('describes how long is left', () => {
    expect(getExpirationLabel(null)).toBe('');
    expect(getExpirationLabel(-1)).toBe('Expired');
    expect(getExpirationLabel(0)).toBe('Expires today');
    expect(getExpirationLabel(1)).toBe('1 day left');
    expect(getExpirationLabel(7)).toBe('7 days left');
  });
});

describe('getSignupErrorMessage', () => {
  it('explains known error codes and keeps the code for searching', () => {
    expect(getSignupErrorMessage('C-1007')).toBe('The username is already in use. (C-1007)');
  });

  it('falls back to the code for unknown errors', () => {
    expect(getSignupErrorMessage('X-0000')).toBe('Salesforce reported error code X-0000.');
    expect(getSignupErrorMessage(null)).toContain('did not report');
  });
});

describe('findConnectedOrg', () => {
  const record: ScratchOrgInfoRecord = { Id: '1', ScratchOrg: '00D000000000001', SignupUsername: 'test-abc@example.com' };

  it('matches the 15 character org id against the 18 character one', () => {
    const org = buildOrg({});
    expect(findConnectedOrg(record, [buildOrg({ uniqueId: 'other', organizationId: '00D000000000002AAA' }), org])).toBe(org);
  });

  it('prefers the admin user the scratch org was created with', () => {
    const otherUser = buildOrg({ uniqueId: 'other-user', username: 'second.user@example.com' });
    const adminUser = buildOrg({ uniqueId: 'admin-user' });
    expect(findConnectedOrg(record, [otherUser, adminUser])).toBe(adminUser);
    expect(findConnectedOrg(record, [otherUser])).toBe(otherUser);
  });

  it('returns null when nothing is connected or the scratch org does not exist yet', () => {
    expect(findConnectedOrg(record, [])).toBeNull();
    expect(findConnectedOrg({ Id: '1', ScratchOrg: null }, [buildOrg({})])).toBeNull();
  });
});

describe('isCreatedWithJetstream', () => {
  it('recognizes the web and desktop callbacks', () => {
    expect(isCreatedWithJetstream({ Id: '1', ConnectedAppCallbackUrl: 'https://getjetstream.app/oauth/sfdc/callback' })).toBe(true);
    expect(isCreatedWithJetstream({ Id: '1', ConnectedAppCallbackUrl: 'jetstream://addOrg/oauth/sfdc/callback' })).toBe(true);
  });

  it('does not claim scratch orgs created by the Salesforce CLI', () => {
    expect(isCreatedWithJetstream({ Id: '1', ConnectedAppCallbackUrl: 'http://localhost:1717/OauthRedirect' })).toBe(false);
    expect(isCreatedWithJetstream({ Id: '1' })).toBe(false);
  });
});

describe('toScratchOrgRows', () => {
  it('adds the display status, days remaining and connection', () => {
    const org = buildOrg({});
    const [row] = toScratchOrgRows(
      [
        {
          Id: '1',
          Status: 'Active',
          ExpirationDate: '2026-11-29',
          ScratchOrg: '00D000000000001',
          SignupUsername: 'test-abc@example.com',
          CreatedBy: { Name: 'Ada Lovelace' },
          ConnectedAppCallbackUrl: 'https://getjetstream.app/oauth/sfdc/callback',
        },
      ],
      [org],
      NOW,
    );

    expect(row).toMatchObject({
      displayStatus: 'Active',
      daysRemaining: 2,
      createdByName: 'Ada Lovelace',
      connectedOrg: org,
      createdWithJetstream: true,
    });
  });

  it('does not report a deleted scratch org as connected', () => {
    const [row] = toScratchOrgRows(
      [{ Id: '1', Status: 'Deleted', ScratchOrg: '00D000000000001', ExpirationDate: '2026-11-29' }],
      [buildOrg({})],
      NOW,
    );

    expect(row.connectedOrg).toBeNull();
    expect(row.daysRemaining).toBeNull();
  });
});

describe('generatePassword', () => {
  it('includes every character class at the requested length', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword(16);
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()_\-[\]]/);
    }
  });

  it('does not repeat', () => {
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
});

describe('getUserAlias', () => {
  it('builds an alias of at most 8 characters', () => {
    expect(getUserAlias('Ada', 'Lovelace')).toBe('ALovelac');
    expect(getUserAlias('', "O'Brien")).toBe('OBrien');
    expect(getUserAlias('', '---')).toBe('user');
  });
});
