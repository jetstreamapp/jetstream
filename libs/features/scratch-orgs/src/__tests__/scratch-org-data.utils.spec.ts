import { describeSObject, genericRequest, query, sobjectOperation } from '@jetstream/shared/data';
import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScratchOrgUser,
  deleteScratchOrg,
  fetchScratchOrgLimits,
  fetchScratchOrgs,
  MAX_SCRATCH_ORGS,
  NotDevHubError,
} from '../scratch-org-data.utils';

vi.mock('@jetstream/shared/data', () => ({
  describeSObject: vi.fn(),
  genericRequest: vi.fn(),
  query: vi.fn(),
  sobjectOperation: vi.fn(),
}));

const devHubOrg = { uniqueId: 'dev-hub', userId: '005000000000001AAA' } as SalesforceOrgUi;

function mockQueryRecords(records: unknown[], done = true) {
  vi.mocked(query).mockResolvedValue({ queryResults: { records, totalSize: records.length, done } } as never);
}

function mockDescribe(fields: string[], queryable = true) {
  vi.mocked(describeSObject).mockResolvedValue({ data: { queryable, fields: fields.map((name) => ({ name })) } } as never);
}

describe('fetchScratchOrgs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('only queries the fields this user can see, and never the auth code', async () => {
    mockDescribe(['Id', 'OrgName', 'Status', 'AuthCode', 'CreatedById', 'SomeOtherField']);
    mockQueryRecords([{ Id: '2SR000000000001AAA' }]);

    const result = await fetchScratchOrgs(devHubOrg, { includeDeleted: false });

    expect(result).toEqual({ records: [{ Id: '2SR000000000001AAA' }], hasMore: false });
    expect(vi.mocked(query).mock.calls[0][1]).toBe(
      `SELECT Id, OrgName, Status, CreatedById, CreatedBy.Name FROM ScratchOrgInfo WHERE Status != 'Deleted' ORDER BY CreatedDate DESC LIMIT ${MAX_SCRATCH_ORGS + 1}`,
    );
  });

  it('includes deleted scratch orgs on request', async () => {
    mockDescribe(['Id']);
    mockQueryRecords([]);

    await fetchScratchOrgs(devHubOrg, { includeDeleted: true });

    expect(vi.mocked(query).mock.calls[0][1]).not.toContain('WHERE');
  });

  it('reports when there are more scratch orgs than are listed', async () => {
    mockDescribe(['Id']);
    mockQueryRecords(Array.from({ length: MAX_SCRATCH_ORGS + 1 }, (_, i) => ({ Id: `${i}` })));

    const result = await fetchScratchOrgs(devHubOrg, { includeDeleted: true });

    expect(result.records).toHaveLength(MAX_SCRATCH_ORGS);
    expect(result.hasMore).toBe(true);
  });

  it.each(['The requested resource does not exist', 'NOT_FOUND', "sObject type 'ScratchOrgInfo' is not supported. INVALID_TYPE"])(
    'treats "%s" as an org that is not a Dev Hub',
    async (message) => {
      vi.mocked(describeSObject).mockRejectedValue(new Error(message));

      await expect(fetchScratchOrgs(devHubOrg, { includeDeleted: false })).rejects.toBeInstanceOf(NotDevHubError);
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('treats an object that cannot be queried as an org that is not a Dev Hub', async () => {
    mockDescribe(['Id'], false);

    await expect(fetchScratchOrgs(devHubOrg, { includeDeleted: false })).rejects.toBeInstanceOf(NotDevHubError);
  });

  it('does not mistake other failures for an org that is not a Dev Hub', async () => {
    vi.mocked(describeSObject).mockRejectedValue(new Error('Network Error'));

    await expect(fetchScratchOrgs(devHubOrg, { includeDeleted: false })).rejects.toThrow('Network Error');
  });
});

describe('fetchScratchOrgLimits', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the scratch org allocations', async () => {
    vi.mocked(genericRequest).mockResolvedValue({
      ActiveScratchOrgs: { Max: 40, Remaining: 37 },
      DailyScratchOrgs: { Max: 80, Remaining: 80 },
    });

    await expect(fetchScratchOrgLimits(devHubOrg)).resolves.toEqual({
      active: { max: 40, remaining: 37 },
      daily: { max: 80, remaining: 80 },
    });
  });

  it('reports unknown limits instead of failing the page', async () => {
    vi.mocked(genericRequest).mockRejectedValue(new Error('nope'));

    await expect(fetchScratchOrgLimits(devHubOrg)).resolves.toEqual({ active: null, daily: null });
  });
});

describe('deleteScratchOrg', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(sobjectOperation).mockResolvedValue([{ success: true, id: '1' }] as never);
  });

  it('deletes the ActiveScratchOrg of an active scratch org', async () => {
    mockQueryRecords([{ Id: '2Sc000000000001AAA' }]);

    await deleteScratchOrg(devHubOrg, { Id: '2SR000000000001AAA', Status: 'Active' });

    expect(vi.mocked(query).mock.calls[0][1]).toBe(`SELECT Id FROM ActiveScratchOrg WHERE ScratchOrgInfoId = '2SR000000000001AAA'`);
    expect(sobjectOperation).toHaveBeenCalledTimes(1);
    expect(sobjectOperation).toHaveBeenCalledWith(devHubOrg, 'ActiveScratchOrg', 'delete', { ids: ['2Sc000000000001AAA'] });
  });

  it('never deletes the request of an active scratch org whose ActiveScratchOrg cannot be found', async () => {
    mockQueryRecords([]);

    await expect(deleteScratchOrg(devHubOrg, { Id: '2SR000000000001AAA', Status: 'Active' })).rejects.toThrow('could not be found');
    expect(sobjectOperation).not.toHaveBeenCalled();
  });

  it.each(['Error', 'New', 'Creating'] as const)('removes the request of a scratch org with status %s', async (Status) => {
    await deleteScratchOrg(devHubOrg, { Id: '2SR000000000001AAA', Status });

    expect(query).not.toHaveBeenCalled();
    expect(sobjectOperation).toHaveBeenCalledWith(devHubOrg, 'ScratchOrgInfo', 'delete', { ids: ['2SR000000000001AAA'] });
  });

  it('surfaces the reason Salesforce refused the delete', async () => {
    mockQueryRecords([{ Id: '2Sc000000000001AAA' }]);
    vi.mocked(sobjectOperation).mockResolvedValue([
      { success: false, errors: [{ message: 'insufficient access rights', statusCode: 'INSUFFICIENT_ACCESS', fields: [] }] },
    ] as never);

    await expect(deleteScratchOrg(devHubOrg, { Id: '2SR000000000001AAA', Status: 'Active' })).rejects.toThrow('insufficient access rights');
  });
});

describe('createScratchOrgUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('copies the locale of the connected user and derives the alias', async () => {
    mockQueryRecords([{ TimeZoneSidKey: 'America/Denver', LocaleSidKey: 'en_US', EmailEncodingKey: 'UTF-8', LanguageLocaleKey: 'en_US' }]);
    vi.mocked(sobjectOperation).mockResolvedValue([{ success: true, id: '005000000000009AAA' }] as never);

    const userId = await createScratchOrgUser(devHubOrg, {
      firstName: ' Grace ',
      lastName: 'Hopper',
      email: 'grace@example.com',
      username: 'Grace.Hopper@Example.com ',
      profileId: '00e000000000001AAA',
    });

    expect(userId).toBe('005000000000009AAA');
    expect(sobjectOperation).toHaveBeenCalledWith(devHubOrg, 'User', 'create', {
      records: [
        {
          FirstName: 'Grace',
          LastName: 'Hopper',
          Email: 'grace@example.com',
          Username: 'grace.hopper@example.com',
          Alias: 'GHopper',
          ProfileId: '00e000000000001AAA',
          TimeZoneSidKey: 'America/Denver',
          LocaleSidKey: 'en_US',
          EmailEncodingKey: 'UTF-8',
          LanguageLocaleKey: 'en_US',
        },
      ],
    });
  });

  it('surfaces the reason Salesforce refused the user', async () => {
    mockQueryRecords([{ TimeZoneSidKey: 'America/Denver', LocaleSidKey: 'en_US', EmailEncodingKey: 'UTF-8', LanguageLocaleKey: 'en_US' }]);
    vi.mocked(sobjectOperation).mockResolvedValue([
      { success: false, errors: [{ message: 'Duplicate Username', statusCode: 'DUPLICATE_USERNAME', fields: ['Username'] }] },
    ] as never);

    await expect(
      createScratchOrgUser(devHubOrg, {
        firstName: '',
        lastName: 'Hopper',
        email: 'g@example.com',
        username: 'g@example.com',
        profileId: '1',
      }),
    ).rejects.toThrow('Duplicate Username');
  });
});
