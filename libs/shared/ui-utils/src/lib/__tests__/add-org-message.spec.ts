import { getOrgFromAddOrgMessage } from '../add-org-message';

const SERVER_ORIGIN = 'https://getjetstream.app';

const validOrg = {
  uniqueId: 'org-1',
  label: 'My Org',
  instanceUrl: 'https://example.my.salesforce.com',
  loginUrl: 'https://login.salesforce.com',
  username: 'user@example.com',
  organizationId: '00D000000000001',
  orgIsSandbox: 'false',
};

describe('getOrgFromAddOrgMessage', () => {
  const popupWindow = {} as Window;

  function buildEvent(overrides: Partial<Pick<MessageEvent, 'data' | 'origin' | 'source'>> = {}) {
    return { data: JSON.stringify(validOrg), origin: SERVER_ORIGIN, source: popupWindow as unknown as MessageEventSource, ...overrides };
  }

  it('returns the org for a message from the server origin and the popup window', () => {
    const org = getOrgFromAddOrgMessage(buildEvent(), SERVER_ORIGIN, popupWindow);
    expect(org).toMatchObject({ uniqueId: 'org-1', username: 'user@example.com', orgIsSandbox: false });
  });

  it('coerces the string orgIsSandbox flag to a boolean', () => {
    const org = getOrgFromAddOrgMessage(
      buildEvent({ data: JSON.stringify({ ...validOrg, orgIsSandbox: 'true' }) }),
      SERVER_ORIGIN,
      popupWindow,
    );
    expect(org?.orgIsSandbox).toBe(true);
  });

  it('ignores a message from another origin', () => {
    expect(getOrgFromAddOrgMessage(buildEvent({ origin: 'https://evil.example' }), SERVER_ORIGIN, popupWindow)).toBeNull();
  });

  it('ignores a message from a window other than the popup', () => {
    const otherWindow = {} as Window;
    expect(
      getOrgFromAddOrgMessage(buildEvent({ source: otherWindow as unknown as MessageEventSource }), SERVER_ORIGIN, popupWindow),
    ).toBeNull();
  });

  it('ignores every message when no popup window was opened', () => {
    expect(getOrgFromAddOrgMessage(buildEvent(), SERVER_ORIGIN, null)).toBeNull();
  });

  it('ignores non-string and unparseable data', () => {
    expect(getOrgFromAddOrgMessage(buildEvent({ data: validOrg }), SERVER_ORIGIN, popupWindow)).toBeNull();
    expect(getOrgFromAddOrgMessage(buildEvent({ data: '{not json' }), SERVER_ORIGIN, popupWindow)).toBeNull();
  });

  it('ignores a payload that is not an org object', () => {
    expect(getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify('org-1') }), SERVER_ORIGIN, popupWindow)).toBeNull();
    expect(getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify([validOrg]) }), SERVER_ORIGIN, popupWindow)).toBeNull();
    expect(getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify(null) }), SERVER_ORIGIN, popupWindow)).toBeNull();
  });

  it('ignores a payload missing a required org field', () => {
    const { uniqueId: _omitted, ...missingUniqueId } = validOrg;
    expect(getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify(missingUniqueId) }), SERVER_ORIGIN, popupWindow)).toBeNull();
    expect(
      getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify({ ...validOrg, username: '' }) }), SERVER_ORIGIN, popupWindow),
    ).toBeNull();
    expect(
      getOrgFromAddOrgMessage(buildEvent({ data: JSON.stringify({ ...validOrg, label: 42 }) }), SERVER_ORIGIN, popupWindow),
    ).toBeNull();
  });
});
