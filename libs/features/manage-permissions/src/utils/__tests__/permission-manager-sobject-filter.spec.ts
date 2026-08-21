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

/**
 * The permission manager reads two independent allow-lists, both from a `SobjectType` restricted picklist:
 * object CRUD on `ObjectPermissions` and field level security on `FieldPermissions`.
 */
function mockAllowLists(options: {
  objectPermissions?: Partial<PicklistEntry>[] | null;
  fieldPermissions?: Partial<PicklistEntry>[] | null;
  rejectObjectPermissions?: boolean;
  rejectFieldPermissions?: boolean;
}) {
  describeSObject.mockImplementation((_org: SalesforceOrgUi, sobject: string) => {
    const isObjectPermissions = sobject === 'ObjectPermissions';
    if (isObjectPermissions ? options.rejectObjectPermissions : options.rejectFieldPermissions) {
      return Promise.reject(new Error('INVALID_SESSION_ID'));
    }
    return Promise.resolve({
      data: {
        fields: [
          { name: 'ParentId', picklistValues: null },
          { name: 'SobjectType', picklistValues: isObjectPermissions ? options.objectPermissions : options.fieldPermissions },
        ],
      } as unknown as DescribeSObjectResult,
    });
  });
}

describe('getPermissionableSobjects', () => {
  beforeEach(() => {
    describeSObject.mockReset();
  });

  it('reads the SobjectType picklist from both describes', async () => {
    mockAllowLists({
      objectPermissions: [
        { value: 'Account', active: true },
        { value: 'Contact', active: true },
      ],
      fieldPermissions: [{ value: 'Account', active: true }],
    });

    const results = await getPermissionableSobjects(org);

    expect(describeSObject).toHaveBeenCalledWith(org, 'ObjectPermissions');
    expect(describeSObject).toHaveBeenCalledWith(org, 'FieldPermissions');
    expect(results?.objectPermissions).toEqual(new Set(['Account', 'Contact']));
  });

  // Salesforce omits children whose record access rolls up to a parent from ObjectPermissions, but they
  // still accept FieldPermissions - the reported bug was PricebookEntry disappearing from the object picker.
  it('includes objects that only support field permissions', async () => {
    mockAllowLists({
      objectPermissions: [{ value: 'Account', active: true }],
      fieldPermissions: [
        { value: 'Account', active: true },
        { value: 'PricebookEntry', active: true },
        { value: 'OpportunityLineItem', active: true },
      ],
    });

    const results = await getPermissionableSobjects(org);

    expect(results?.all).toEqual(new Set(['Account', 'PricebookEntry', 'OpportunityLineItem']));
    expect(results?.objectPermissions).toEqual(new Set(['Account']));
  });

  it('omits values explicitly marked inactive but keeps values with no active flag', async () => {
    mockAllowLists({
      objectPermissions: [{ value: 'Account', active: true }, { value: 'Retired__c', active: false }, { value: 'Contact' }],
      fieldPermissions: [{ value: 'Archived__c', active: false }, { value: 'Task' }],
    });

    const results = await getPermissionableSobjects(org);

    expect(results?.objectPermissions).toEqual(new Set(['Account', 'Contact']));
    expect(results?.all).toEqual(new Set(['Account', 'Contact', 'Task']));
  });

  it.each([
    ['no picklist values', []],
    ['a missing picklist', null],
    ['every value inactive', [{ value: 'Account', active: false }]],
  ])('returns null when both describes return %s so callers fall back to the heuristic', async (_label, picklistValues) => {
    mockAllowLists({ objectPermissions: picklistValues, fieldPermissions: picklistValues });

    expect(await getPermissionableSobjects(org)).toBeNull();
  });

  it('returns null when both describes fail', async () => {
    mockAllowLists({ rejectObjectPermissions: true, rejectFieldPermissions: true });

    expect(await getPermissionableSobjects(org)).toBeNull();
  });

  it('still returns the object permission allow-list when the FieldPermissions describe fails', async () => {
    mockAllowLists({ objectPermissions: [{ value: 'Account', active: true }], rejectFieldPermissions: true });

    const results = await getPermissionableSobjects(org);

    expect(results?.all).toEqual(new Set(['Account']));
    expect(results?.objectPermissions).toEqual(new Set(['Account']));
  });

  it('still returns field-only objects when the ObjectPermissions describe fails', async () => {
    mockAllowLists({ rejectObjectPermissions: true, fieldPermissions: [{ value: 'PricebookEntry', active: true }] });

    const results = await getPermissionableSobjects(org);

    expect(results?.all).toEqual(new Set(['PricebookEntry']));
    expect(results?.objectPermissions).toEqual(new Set());
  });
});

describe('getPermissionsSobjectFilter', () => {
  it('keeps only objects present in the allow-list', () => {
    const filterFn = getPermissionsSobjectFilter({
      objectPermissions: new Set(['Account', 'Idea', 'Custom__c']),
      all: new Set(['Account', 'Idea', 'Custom__c', 'Task', 'PricebookEntry']),
    });

    expect(filterFn(buildSobject('Account'))).toBe(true);
    expect(filterFn(buildSobject('Custom__c'))).toBe(true);
    // Field permissions only. PricebookEntry exposes no settable field, but stays in the picker so the
    // list matches Salesforce and tab visibility remains reachable.
    expect(filterFn(buildSobject('Task'))).toBe(true);
    expect(filterFn(buildSobject('PricebookEntry'))).toBe(true);
    // Objects that fail on save with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST despite being createable
    expect(filterPermissionsSobjects(buildSobject('ApexClass'))).toBe(true);
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
