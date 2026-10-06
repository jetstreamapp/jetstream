import { describe, expect, test, vi } from 'vitest';
import { getMyDomainHostForPage, getRecordPageObject, getRecordPageRecordId, selectApiSessionCookie } from '../web-extension.utils';

// The module imports the polyfill at load time, which refuses to initialize outside an extension.
// Nothing under test touches the `browser` API, so a stub is enough to get the module loaded.
vi.mock('webextension-polyfill', () => ({ default: { runtime: { sendMessage: vi.fn() } } }));

describe('getRecordPageRecordId', () => {
  test('reads the id positionally for objects with long API names', () => {
    // Regression: an id-shaped search matched the first 18 characters of the object name instead.
    expect(getRecordPageRecordId('/lightning/r/OpportunityLineItem/00k5j000000AbCdAAK/view')).toBe('00k5j000000AbCdAAK');
    expect(getRecordPageRecordId('/lightning/r/ServiceAppointment/08p5j000000AbCdAAK/view')).toBe('08p5j000000AbCdAAK');
    expect(getRecordPageRecordId('/lightning/r/OpportunityContactRole/00K5j000000AbCdEAK/view')).toBe('00K5j000000AbCdEAK');
  });

  test('reads the id for short object names', () => {
    expect(getRecordPageRecordId('/lightning/r/Account/0015j00000AbCdEAAV/view')).toBe('0015j00000AbCdEAAV');
    expect(getRecordPageRecordId('/lightning/r/Opportunity/0065j00000AbCdEAAV/edit')).toBe('0065j00000AbCdEAAV');
  });

  test('reads classic short URLs without the leading slash', () => {
    expect(getRecordPageRecordId('/001D000000IqhSL')).toBe('001D000000IqhSL');
    expect(getRecordPageRecordId('/001D000000IqhSLIAZ')).toBe('001D000000IqhSLIAZ');
  });

  test('rejects ids that fail the checksum instead of returning them', () => {
    // The validation guard used to return the value on both branches, so bad ids were used anyway.
    // `0015j00000AbCdE` checksums to `AAV`, so an `AAA` suffix is not a real id.
    expect(getRecordPageRecordId('/lightning/r/Account/0015j00000AbCdEAAA/view')).toBeUndefined();
  });

  test('returns nothing for non-record pages', () => {
    expect(getRecordPageRecordId('')).toBeUndefined();
    expect(getRecordPageRecordId('/lightning/o/Account/list')).toBeUndefined();
    expect(getRecordPageRecordId('/lightning/r/Account/0015j00000AbCdEAAV/related')).toBeUndefined();
  });
});

describe('getRecordPageObject', () => {
  test('returns the object name from record and object pages', () => {
    expect(getRecordPageObject('/lightning/r/OpportunityLineItem/00k5j000000AbCdAAK/view')).toBe('OpportunityLineItem');
    expect(getRecordPageObject('/lightning/r/Account/0015j00000AbCdEAAV/view')).toBe('Account');
    expect(getRecordPageObject('/lightning/o/Account/list')).toBe('Account');
  });

  test('returns nothing when the path is not a Salesforce object or record page', () => {
    expect(getRecordPageObject('')).toBeUndefined();
    expect(getRecordPageObject('/lightning/setup/SetupOneHome/home')).toBeUndefined();
  });
});

describe('getMyDomainHostForPage', () => {
  test('maps Lightning and Setup hosts to their My Domain host', () => {
    expect(getMyDomainHostForPage('acme.lightning.force.com')).toBe('acme.my.salesforce.com');
    expect(getMyDomainHostForPage('acme--uat.sandbox.lightning.force.com')).toBe('acme--uat.sandbox.my.salesforce.com');
    expect(getMyDomainHostForPage('acme-dev-ed.develop.my.salesforce-setup.com')).toBe('acme-dev-ed.develop.my.salesforce.com');
    expect(getMyDomainHostForPage('acme.my.salesforce.com')).toBe('acme.my.salesforce.com');
  });

  test('returns nothing for hosts it cannot map', () => {
    expect(getMyDomainHostForPage('acme--c.vf.force.com')).toBeUndefined();
    expect(getMyDomainHostForPage('na123.salesforce.com')).toBeUndefined();
  });
});

describe('selectApiSessionCookie', () => {
  const orgId = '00D5j000000AbCd';

  test("prefers the page's My Domain over an older cookie for the same org", () => {
    // Regression: after a My Domain rename the old hostname's cookie came back first (oldest first) and
    // its dead session failed every API call with "Session expired or invalid".
    const cookies = [
      { domain: 'old-name.my.salesforce.com', value: `${orgId}!stale` },
      { domain: 'new-name.my.salesforce.com', value: `${orgId}!current` },
    ];
    expect(selectApiSessionCookie(cookies, orgId, 'new-name.lightning.force.com')?.domain).toBe('new-name.my.salesforce.com');
  });

  test('falls back to the first cookie for the org when the page host cannot be mapped', () => {
    const cookies = [
      { domain: 'other.my.salesforce.com', value: '00D000000000001!other-org' },
      { domain: 'acme.my.salesforce.com', value: `${orgId}!current` },
    ];
    expect(selectApiSessionCookie(cookies, orgId, 'acme--c.vf.force.com')?.domain).toBe('acme.my.salesforce.com');
  });

  test('returns nothing without an org id or a cookie for the org', () => {
    const cookies = [{ domain: 'acme.my.salesforce.com', value: `${orgId}!current` }];
    expect(selectApiSessionCookie(cookies, undefined, 'acme.lightning.force.com')).toBeUndefined();
    expect(selectApiSessionCookie(cookies, '00D000000000001', 'acme.lightning.force.com')).toBeUndefined();
  });
});
