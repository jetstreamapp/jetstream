import { ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, RecordResult, SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPermissionSet,
  generatePermissionSetApiName,
  getCloneSourceGroups,
  isValidPermissionSetApiName,
} from '../permission-set-create-utils';

const { describeSObject, queryAll, sobjectOperation } = vi.hoisted(() => ({
  describeSObject: vi.fn(),
  queryAll: vi.fn(),
  sobjectOperation: vi.fn(),
}));

vi.mock('@jetstream/shared/data', () => ({
  describeSObject,
  queryAll,
  sobjectOperation,
  updatePermissionSetRecords: vi.fn(),
}));

const org = { uniqueId: 'org-1' } as SalesforceOrgUi;
const SOURCE_ID = '0PSsource';
const NEW_ID = '0PSnew';

const input = { label: 'Sales Ops', name: 'Sales_Ops', description: '', licenseId: null, hasActivationRequired: false };

type SobjectRecord = Record<string, unknown> & { attributes: { type: string } };

/** Every call made to Salesforce, in order, so tests can assert on sequencing */
let operations: { sobject: string; operation: string; records: SobjectRecord[] }[] = [];

function success(id = 'id'): RecordResult {
  return { success: true, id };
}

function failure(message: string, statusCode = 'FIELD_INTEGRITY_EXCEPTION'): RecordResult {
  return { success: false, errors: [{ message, statusCode, fields: [] }] };
}

function mockSource(source: {
  systemPermissions?: Record<string, boolean>;
  objectPermissions?: Record<string, unknown>[];
  fieldPermissions?: Record<string, unknown>[];
  setupEntityAccess?: Record<string, unknown>[];
  tabSettings?: Record<string, unknown>[];
}) {
  const systemPermissions = source.systemPermissions || {};
  describeSObject.mockResolvedValue({
    data: {
      fields: Object.keys(systemPermissions).map((name) => ({ name, label: name, type: 'boolean', updateable: true, createable: true })),
    },
  });
  queryAll.mockImplementation((_org: SalesforceOrgUi, soql: string) => {
    let records: Record<string, unknown>[] = [];
    if (soql.includes('FROM PermissionSet ')) {
      records = [{ Id: SOURCE_ID, ...systemPermissions }];
    } else if (soql.includes('FROM ObjectPermissions')) {
      records = source.objectPermissions || [];
    } else if (soql.includes('FROM FieldPermissions')) {
      records = source.fieldPermissions || [];
    } else if (soql.includes('FROM SetupEntityAccess')) {
      records = source.setupEntityAccess || [];
    } else if (soql.includes('FROM PermissionSetTabSetting')) {
      records = source.tabSettings || [];
    }
    return Promise.resolve({ queryResults: { records: records.map((record) => ({ attributes: { type: 'x' }, ...record })) } });
  });
}

/**
 * @param handler returns the result for each record, defaults to success
 */
function mockSobjectOperation(handler?: (sobject: string, operation: string, record: SobjectRecord) => RecordResult | undefined) {
  sobjectOperation.mockImplementation(
    (_org: SalesforceOrgUi, sobject: string, operation: string, { records }: { records: SobjectRecord[] }) => {
      operations.push({ sobject, operation, records });
      return Promise.resolve(
        records.map((record) => {
          const result = handler?.(sobject, operation, record);
          if (result) {
            return result;
          }
          return success(sobject === 'PermissionSet' && operation === 'create' ? NEW_ID : 'id');
        }),
      );
    },
  );
}

beforeEach(() => {
  operations = [];
  describeSObject.mockReset();
  queryAll.mockReset();
  sobjectOperation.mockReset();
});

describe('getCloneSourceGroups', () => {
  function permissionSetItem(label: string, record: Partial<PermissionSetNoProfileRecord>): ListItem<string, PermissionSetNoProfileRecord> {
    // the selection lists put extra detail beside the label, which the clone picker replaces
    return { id: label, label, value: label, secondaryLabel: `${record.Name} • extra`, meta: record as PermissionSetNoProfileRecord };
  }

  function profileItem(label: string): ListItem<string, PermissionSetWithProfileRecord> {
    return { id: label, label, value: label, secondaryLabel: 'Standard Profile', meta: {} as PermissionSetWithProfileRecord };
  }

  it('groups permission sets, managed permission sets and profiles, each sorted by label', () => {
    const groups = getCloneSourceGroups(
      [profileItem('Standard User'), profileItem('Contract Manager')],
      [permissionSetItem('Sales Ops', { Name: 'Sales_Ops' }), permissionSetItem('admin tools', { Name: 'Admin_Tools' })],
      [
        permissionSetItem('Sales Cloud User', { Name: 'SalesCloudUser', Type: 'Standard', NamespacePrefix: null }),
        permissionSetItem('CPQ Admin', { Name: 'SteelBrickCPQAdmin', Type: 'Regular', NamespacePrefix: 'SBQQ' }),
      ],
    );

    expect(groups.map(({ label, items }) => ({ label, items: items.map((item) => item.label) }))).toEqual([
      { label: 'Permission Sets', items: ['admin tools', 'Sales Ops'] },
      { label: 'Managed Permission Sets', items: ['CPQ Admin', 'Sales Cloud User'] },
      { label: 'Profiles', items: ['Contract Manager', 'Standard User'] },
    ]);
    expect(groups[0].items[0]).toMatchObject({ secondaryLabel: 'Admin_Tools', secondaryLabelOnNewLine: true });
    expect(groups[0].items[0].tertiaryLabel).toBeUndefined();
    expect(groups[1].items[0]).toMatchObject({ secondaryLabel: 'SteelBrickCPQAdmin', tertiaryLabel: 'Managed package: SBQQ' });
    expect(groups[1].items[1]).toMatchObject({ secondaryLabel: 'SalesCloudUser', tertiaryLabel: 'Provided by Salesforce' });
    expect(groups[2].items[0]).toMatchObject({ secondaryLabel: 'Standard Profile', secondaryLabelOnNewLine: true });
  });

  it('leaves out empty groups', () => {
    expect(getCloneSourceGroups([profileItem('Standard User')], [], []).map(({ id }) => id)).toEqual(['Profile']);
  });
});

describe('generatePermissionSetApiName', () => {
  it.each([
    ['Sales Ops', 'Sales_Ops'],
    ['  Sales -- Ops!  ', 'Sales_Ops'],
    ['2024 Access', 'X2024_Access'],
    ['', ''],
  ])('converts %j to %j', (label, expected) => {
    expect(generatePermissionSetApiName(label)).toBe(expected);
  });

  it('caps the name at 80 characters without a trailing underscore', () => {
    const apiName = generatePermissionSetApiName(`${'a'.repeat(79)} b`);
    expect(apiName).toBe('a'.repeat(79));
    expect(isValidPermissionSetApiName(apiName)).toBe(true);
  });
});

describe('isValidPermissionSetApiName', () => {
  it.each([
    ['Sales_Ops', true],
    ['X1', true],
    ['1Sales', false],
    ['_Sales', false],
    ['Sales_', false],
    ['Sales__Ops', false],
    ['Sales Ops', false],
  ])('%j is %s', (name, expected) => {
    expect(isValidPermissionSetApiName(name)).toBe(expected);
  });
});

describe('createPermissionSet', () => {
  it('creates a blank permission set without reading any source permissions', async () => {
    mockSobjectOperation();

    const result = await createPermissionSet(org, { ...input, description: 'Desc', licenseId: '100abc' });

    expect(result).toEqual({ id: NEW_ID, cloneSteps: [] });
    expect(queryAll).not.toHaveBeenCalled();
    expect(operations).toHaveLength(1);
    expect(operations[0].records[0]).toMatchObject({ Name: 'Sales_Ops', Label: 'Sales Ops', Description: 'Desc', LicenseId: '100abc' });
  });

  it('throws when Salesforce rejects the permission set', async () => {
    mockSobjectOperation(() => failure('The API Name is already in use', 'DUPLICATE_DEVELOPER_NAME'));

    await expect(createPermissionSet(org, input)).rejects.toThrow('The API Name is already in use');
  });

  it('copies object permissions first and system permissions last', async () => {
    mockSource({
      systemPermissions: { PermissionsApiEnabled: true, PermissionsModifyAllData: true, PermissionsViewSetup: false },
      objectPermissions: [{ SobjectType: 'Account', PermissionsRead: true }],
      fieldPermissions: [{ SobjectType: 'Account', Field: 'Account.Industry', PermissionsRead: true, PermissionsEdit: false }],
      setupEntityAccess: [{ SetupEntityId: '01pclass' }],
      tabSettings: [{ Name: 'standard-Account', Visibility: 'DefaultOn' }],
    });
    mockSobjectOperation();

    const result = await createPermissionSet(org, input, SOURCE_ID);

    const sequence = operations.map(({ sobject, operation }) => `${operation}:${sobject}`);
    expect(sequence[0]).toBe('create:PermissionSet');
    expect(sequence[1]).toBe('create:ObjectPermissions');
    expect(sequence.at(-1)).toBe('update:PermissionSet');

    // the new permission set is created without system permissions - they are applied after their dependencies exist
    expect(Object.keys(operations[0].records[0]).some((key) => key.startsWith('Permissions'))).toBe(false);
    expect(operations.at(-1)?.records[0]).toEqual({
      attributes: { type: 'PermissionSet' },
      Id: NEW_ID,
      PermissionsApiEnabled: true,
      PermissionsModifyAllData: true,
    });

    const fieldPermissions = operations.find(({ sobject }) => sobject === 'FieldPermissions');
    expect(fieldPermissions?.records[0]).toEqual({
      attributes: { type: 'FieldPermissions' },
      SobjectType: 'Account',
      Field: 'Account.Industry',
      PermissionsRead: true,
      PermissionsEdit: false,
      ParentId: NEW_ID,
    });

    expect(result.cloneSteps.map(({ key, total, failed }) => ({ key, total, failed }))).toEqual([
      { key: 'objectPermissions', total: 1, failed: 0 },
      { key: 'fieldPermissions', total: 1, failed: 0 },
      { key: 'setupEntityAccess', total: 1, failed: 0 },
      { key: 'tabSettings', total: 1, failed: 0 },
      { key: 'systemPermissions', total: 2, failed: 0 },
    ]);
  });

  it('retries object permissions that depend on another object in the same batch', async () => {
    mockSource({
      objectPermissions: [{ SobjectType: 'DevopsPipeline' }, { SobjectType: 'SourceCodeRepository' }, { SobjectType: 'Idea' }],
    });
    const created = new Set<string>();
    mockSobjectOperation((sobject, _operation, record) => {
      if (sobject !== 'ObjectPermissions') {
        return undefined;
      }
      if (record.SobjectType === 'Idea') {
        return failure("The following permission isn't allowed: View All Idea");
      }
      if (record.SobjectType === 'DevopsPipeline' && !created.has('SourceCodeRepository')) {
        return failure('Permission Read DevopsPipeline depends on permission(s): Read SourceCodeRepository');
      }
      created.add(record.SobjectType as string);
      return undefined;
    });

    const result = await createPermissionSet(org, input, SOURCE_ID);

    const objectPermissionCalls = operations.filter(({ sobject }) => sobject === 'ObjectPermissions');
    // first attempt, a retry that fixes DevopsPipeline, then one more that makes no progress and stops
    expect(objectPermissionCalls.map(({ records }) => records.length)).toEqual([3, 2, 1]);
    expect(result.cloneSteps[0]).toEqual({
      key: 'objectPermissions',
      label: 'Object Permissions',
      total: 3,
      failed: 1,
      errors: [{ message: "The following permission isn't allowed: View All Idea", count: 1 }],
    });
  });

  it('does not report activity fields that Salesforce already created as duplicates', async () => {
    mockSource({
      fieldPermissions: [
        { SobjectType: 'Task', Field: 'Task.Description' },
        { SobjectType: 'Event', Field: 'Event.LocationId' },
      ],
    });
    mockSobjectOperation((sobject, _operation, record) => {
      if (sobject === 'FieldPermissions' && record.Field === 'Task.Description') {
        return failure('Duplicate row exists in FieldPermissions', 'DUPLICATE_VALUE');
      }
      if (sobject === 'FieldPermissions' && record.Field === 'Event.LocationId') {
        return failure('bad value for restricted picklist field: Event.LocationId', 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST');
      }
      return undefined;
    });

    const result = await createPermissionSet(org, input, SOURCE_ID);

    const fieldStep = result.cloneSteps.find(({ key }) => key === 'fieldPermissions');
    expect(fieldStep?.failed).toBe(1);
    expect(fieldStep?.errors).toEqual([{ message: 'bad value for restricted picklist field: Event.LocationId', count: 1 }]);
  });

  it('isolates system permissions Salesforce rejects so the rest are still copied', async () => {
    const systemPermissions = {
      PermissionsA: true,
      PermissionsB: true,
      PermissionsProfileOnly: true,
      PermissionsD: true,
      PermissionsE: true,
    };
    mockSource({ systemPermissions });
    const applied = new Set<string>();
    mockSobjectOperation((sobject, operation, record) => {
      if (sobject !== 'PermissionSet' || operation !== 'update') {
        return undefined;
      }
      if ('PermissionsProfileOnly' in record) {
        return failure("The user license doesn't allow the permission: Profile Only");
      }
      Object.keys(record)
        .filter((key) => key.startsWith('Permissions'))
        .forEach((key) => applied.add(key));
      return undefined;
    });

    const result = await createPermissionSet(org, input, SOURCE_ID);

    expect([...applied].sort()).toEqual(['PermissionsA', 'PermissionsB', 'PermissionsD', 'PermissionsE']);
    expect(result.cloneSteps.at(-1)).toEqual({
      key: 'systemPermissions',
      label: 'System Permissions',
      total: 5,
      failed: 1,
      errors: [{ message: "The user license doesn't allow the permission: Profile Only", count: 1 }],
    });
  });

  it('reports a failed request against every record in that batch without losing the others', async () => {
    mockSource({ setupEntityAccess: Array.from({ length: 250 }, (_, i) => ({ SetupEntityId: `01p${i}` })) });
    let setupEntityAccessCalls = 0;
    sobjectOperation.mockImplementation(
      (_org: SalesforceOrgUi, sobject: string, operation: string, { records }: { records: SobjectRecord[] }) => {
        if (sobject === 'SetupEntityAccess' && setupEntityAccessCalls++ === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(records.map(() => success(sobject === 'PermissionSet' && operation === 'create' ? NEW_ID : 'id')));
      },
    );

    const result = await createPermissionSet(org, input, SOURCE_ID);

    const setupEntityStep = result.cloneSteps.find(({ key }) => key === 'setupEntityAccess');
    expect(setupEntityStep).toMatchObject({ total: 250, failed: 50, errors: [{ message: 'Network error', count: 50 }] });
  });
});
