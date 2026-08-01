import { DescribeGlobalSObjectResult, DescribeSObjectResult, PicklistEntry, SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterPermissionsSobjects, getPermissionableSobjects, getPermissionsSobjectFilter } from '../permission-manager-utils';

const describeSObject = vi.hoisted(() => vi.fn());

vi.mock('@jetstream/shared/data', () => ({
  describeSObject,
  sobjectOperation: vi.fn(),
  updatePermissionSetRecords: vi.fn(),
}));

const org = { uniqueId: 'org-1' } as SalesforceOrgUi;

function buildSobject(name: string, overrides: Partial<DescribeGlobalSObjectResult> = {}): DescribeGlobalSObjectResult {
  return { name, label: name, createable: true, updateable: true, ...overrides } as DescribeGlobalSObjectResult;
}

function mockSobjectTypePicklist(picklistValues: Partial<PicklistEntry>[] | null | undefined) {
  describeSObject.mockResolvedValue({
    data: {
      fields: [
        { name: 'ParentId', picklistValues: null },
        { name: 'SobjectType', picklistValues },
      ],
    } as unknown as DescribeSObjectResult,
  });
}

describe('getPermissionableSobjects', () => {
  beforeEach(() => {
    describeSObject.mockReset();
  });

  it('returns the SobjectType picklist values', async () => {
    mockSobjectTypePicklist([
      { value: 'Account', active: true },
      { value: 'Contact', active: true },
    ]);

    const results = await getPermissionableSobjects(org);

    expect(describeSObject).toHaveBeenCalledWith(org, 'ObjectPermissions');
    expect(results).toEqual(new Set(['Account', 'Contact']));
  });

  it('omits values explicitly marked inactive but keeps values with no active flag', async () => {
    mockSobjectTypePicklist([{ value: 'Account', active: true }, { value: 'Retired__c', active: false }, { value: 'Contact' }]);

    expect(await getPermissionableSobjects(org)).toEqual(new Set(['Account', 'Contact']));
  });

  it.each([
    ['no picklist values', []],
    ['a missing picklist', null],
    ['every value inactive', [{ value: 'Account', active: false }]],
  ])('returns null when describe returns %s so callers fall back to the heuristic', async (_label, picklistValues) => {
    mockSobjectTypePicklist(picklistValues);

    expect(await getPermissionableSobjects(org)).toBeNull();
  });

  it('returns null when describe fails', async () => {
    describeSObject.mockRejectedValue(new Error('INVALID_SESSION_ID'));

    expect(await getPermissionableSobjects(org)).toBeNull();
  });
});

describe('getPermissionsSobjectFilter', () => {
  it('keeps only objects present in the allow-list', () => {
    const filterFn = getPermissionsSobjectFilter(new Set(['Account', 'Idea', 'Custom__c']));

    expect(filterPermissionsSobjects(buildSobject('Task'))).toBe(true);
    expect(filterFn(buildSobject('Account'))).toBe(true);
    expect(filterFn(buildSobject('Custom__c'))).toBe(true);
    // Objects that fail on save with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST despite being createable
    expect(filterFn(buildSobject('Task'))).toBe(false);
    expect(filterFn(buildSobject('ApexClass'))).toBe(false);
    expect(filterFn(buildSobject('Attachment'))).toBe(false);
    expect(filterFn(null)).toBe(false);
  });

  it('falls back to the heuristic filter when the allow-list is unavailable', () => {
    const filterFn = getPermissionsSobjectFilter(null);

    expect(filterFn).toBe(filterPermissionsSobjects);
    expect(filterFn(buildSobject('Account'))).toBe(true);
    expect(filterFn(buildSobject('AccountHistory'))).toBe(false);
    expect(filterFn(buildSobject('ReadOnly__x', { createable: false, updateable: false }))).toBe(false);
    expect(filterFn(buildSobject('Event__e', { createable: false, updateable: false }))).toBe(true);
  });
});
