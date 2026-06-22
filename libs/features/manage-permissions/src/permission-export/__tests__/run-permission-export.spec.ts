import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runPermissionExport } from '../run-permission-export';

const { mockedQuery, mockedQueryMore } = vi.hoisted(() => ({
  mockedQuery: vi.fn(),
  mockedQueryMore: vi.fn(),
}));

vi.mock('@jetstream/shared/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/shared/data')>();
  async function queryWithRecordBudget(
    org: unknown,
    soql: string,
    isTooling: boolean,
    budget: { remaining: number },
    onPage: (records: Record<string, unknown>[]) => void,
  ): Promise<{ truncated: boolean }> {
    let response = await mockedQuery(org, soql, isTooling);
    while (true) {
      const records = response.queryResults.records as Record<string, unknown>[];
      if (budget.remaining <= 0) {
        return { truncated: true };
      }
      if (records.length > budget.remaining) {
        onPage(records.slice(0, budget.remaining));
        budget.remaining = 0;
        return { truncated: true };
      }
      onPage(records);
      budget.remaining -= records.length;
      if (response.queryResults.done) {
        break;
      }
      const nextUrl = response.queryResults.nextRecordsUrl;
      if (!nextUrl) {
        break;
      }
      response = await mockedQueryMore(org, nextUrl, isTooling);
    }
    return { truncated: false };
  }
  return {
    ...actual,
    query: mockedQuery,
    queryMore: mockedQueryMore,
    queryWithRecordBudget,
  };
});

function done<T>(records: T[]) {
  return {
    queryResults: {
      records,
      done: true,
      totalSize: records.length,
    },
  } as any;
}

const PROFILE_PERM_SET_ID = '0PS000000000001';
const PERM_SET_ID = '0PS000000000002';
const GROUP_ID = '0PG000000000001';

const ORG = { uniqueId: 'org-1' } as unknown as SalesforceOrgUi;

describe('runPermissionExport', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedQueryMore.mockReset();
  });

  it('returns an empty merged result when no valid parent ids are provided', async () => {
    const result = await runPermissionExport(ORG, [], []);
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(result.truncated).toBe(false);
    expect(result.full.counts).toEqual({
      permissionSets: 0,
      permissionSetAssignments: 0,
      permissionSetGroups: 0,
      permissionSetGroupComponents: 0,
      mutingPermissionSets: 0,
      objectPermissions: 0,
      fieldPermissions: 0,
      permissionSetTabSettings: 0,
    });
    expect(result.full.findings).toEqual([]);
    expect(result.full.summary).toContain('Exported 0 permission sets');
  });

  it('aggregates query results and builds the merged PermissionExportFullResult shape', async () => {
    const permissionSetRows = [
      { Id: PROFILE_PERM_SET_ID, Name: 'Admin Profile' },
      { Id: PERM_SET_ID, Name: 'CustomPermSet' },
    ];
    const objectPermissionRows = [
      {
        Id: '01p000000000001',
        ParentId: PERM_SET_ID,
        SobjectType: 'Account',
        PermissionsRead: true,
        PermissionsCreate: true,
        PermissionsEdit: true,
        PermissionsDelete: false,
        PermissionsViewAllRecords: false,
        PermissionsModifyAllRecords: false,
        PermissionsViewAllFields: false,
      },
    ];
    const fieldPermissionRows = [
      {
        Id: '01k000000000001',
        ParentId: PERM_SET_ID,
        SobjectType: 'Account',
        Field: 'Account.Name',
        PermissionsRead: true,
        PermissionsEdit: true,
      },
    ];
    const tabSettingRows = [{ Id: '0t0000000000001', ParentId: PERM_SET_ID, Name: 'Account', Visibility: 'DefaultOn' }];
    const assignmentRows = [{ Id: '0Pa000000000001', PermissionSetId: PERM_SET_ID, AssigneeId: '005000000000001' }];
    const componentRows = [{ Id: '0PC000000000001', PermissionSetGroupId: GROUP_ID, PermissionSetId: PERM_SET_ID }];
    const groupRows = [{ Id: GROUP_ID, DeveloperName: 'GroupA', MasterLabel: 'Group A' }];
    const mutingRows: Record<string, unknown>[] = [];

    // The order of queries matches the algorithm: permission sets, then (per parent chunk) object,
    // field, tabs, assignments, components, then (per group chunk) group + muting.
    mockedQuery
      .mockResolvedValueOnce(done(permissionSetRows))
      .mockResolvedValueOnce(done(objectPermissionRows))
      .mockResolvedValueOnce(done(fieldPermissionRows))
      .mockResolvedValueOnce(done(tabSettingRows))
      .mockResolvedValueOnce(done(assignmentRows))
      .mockResolvedValueOnce(done(componentRows))
      .mockResolvedValueOnce(done(groupRows))
      .mockResolvedValueOnce(done(mutingRows));

    const onProgress = vi.fn();

    const result = await runPermissionExport(ORG, [PROFILE_PERM_SET_ID], [PERM_SET_ID], { onProgress });

    expect(result.truncated).toBe(false);
    expect(result.full.counts).toEqual({
      permissionSets: 2,
      permissionSetAssignments: 1,
      permissionSetGroups: 1,
      permissionSetGroupComponents: 1,
      mutingPermissionSets: 0,
      objectPermissions: 1,
      fieldPermissions: 1,
      permissionSetTabSettings: 1,
    });

    expect(result.full.permissionSets).toEqual(permissionSetRows);
    expect(result.full.objectPermissions).toEqual(objectPermissionRows);
    expect(result.full.fieldPermissions).toEqual(fieldPermissionRows);
    expect(result.full.permissionSetTabSettings).toEqual(tabSettingRows);
    expect(result.full.permissionSetAssignments).toEqual(assignmentRows);
    expect(result.full.permissionSetGroupComponents).toEqual(componentRows);
    expect(result.full.permissionSetGroups).toEqual(groupRows);
    expect(result.full.mutingPermissionSets).toEqual(mutingRows);

    expect(result.full.phase).toBe('permission_export_v1');
    expect(result.full.summary).toBe(
      'Exported 2 permission sets, 1 assignments, 1 permission set groups (1 components, 0 muting permission sets), 1 object permission rows, 1 field permission rows, 1 tab settings (truncated=false). 0 issue(s).',
    );

    expect(result.full.requestPayload).toEqual({
      profileIds: [PROFILE_PERM_SET_ID],
      permissionSetIds: [PERM_SET_ID],
    });

    expect(onProgress).toHaveBeenCalled();
    const lastProgressCall = onProgress.mock.calls.at(-1)?.[0];
    expect(lastProgressCall?.label).toBe('Complete');
    expect(lastProgressCall?.percent).toBe(100);
  });

  it('throws when isCanceled returns true before queries run', async () => {
    await expect(runPermissionExport(ORG, [PROFILE_PERM_SET_ID], [], { isCanceled: () => true })).rejects.toThrow('Job canceled');
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
