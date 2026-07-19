import { groupByFlat } from '@jetstream/shared/utils';
import {
  DirtyRow,
  Field,
  PermissionSetWithProfileRecord,
  PermissionTableSystemPermissionCell,
  PermissionTableSystemPermissionCellPermission,
  SystemPermissionDefinitionMap,
} from '@jetstream/types';
import { applySystemPermissionDependencies, getDirtySystemPermissions, getSystemPermissionRows } from '../permission-manager-table-utils';
import { getSystemPermissionFieldsFromDescribe, prepareSystemPermissionSaveData } from '../permission-manager-utils';
import { SYSTEM_PERMISSION_DEPENDENT_CLOSURE, SYSTEM_PERMISSION_REQUIRED_CLOSURE } from '../system-permission-dependencies';

function buildSystemRow(
  apiName: string,
  enabledByParent: Record<string, boolean>,
  baselineByParent?: Record<string, boolean>,
): PermissionTableSystemPermissionCell {
  const permissions: Record<string, PermissionTableSystemPermissionCellPermission> = {};
  for (const parentId of Object.keys(enabledByParent)) {
    const enabled = enabledByParent[parentId];
    const baseline = baselineByParent ? baselineByParent[parentId] : enabled;
    permissions[parentId] = {
      rowKey: apiName,
      parentId,
      sobject: apiName,
      field: apiName,
      enabled,
      enabledIsDirty: enabled !== baseline,
      record: { enabled: baseline },
    };
  }
  return { key: apiName, sobject: apiName, apiName, label: apiName, tableLabel: apiName, permissions };
}

function buildField(name: string, type: string, updateable: boolean, label: string): Field {
  return { name, type, updateable, label } as unknown as Field;
}

function buildCellPermission(
  parentId: string,
  field: string,
  enabled: boolean,
  enabledIsDirty = true,
): PermissionTableSystemPermissionCellPermission {
  return {
    rowKey: field,
    parentId,
    sobject: field,
    field,
    enabled,
    enabledIsDirty,
    // when dirty, the originally loaded value is the opposite of the current value
    record: { enabled: enabledIsDirty ? !enabled : enabled },
  };
}

describe('getSystemPermissionFieldsFromDescribe', () => {
  it('keeps only settable boolean Permissions* fields, sorted by label', () => {
    const fields = [
      buildField('PermissionsModifyAllData', 'boolean', true, 'Modify All Data'),
      buildField('PermissionsApiEnabled', 'boolean', true, 'API Enabled'),
      buildField('PermissionsReadOnlyPerm', 'boolean', false, 'Read Only Perm'), // not updateable
      buildField('PermissionsSomeText', 'string', true, 'Some Text'), // not boolean
      buildField('SomeOtherField', 'boolean', true, 'Other Field'), // not a Permissions* field
    ];

    expect(getSystemPermissionFieldsFromDescribe(fields)).toEqual([
      { name: 'PermissionsApiEnabled', label: 'API Enabled' },
      { name: 'PermissionsModifyAllData', label: 'Modify All Data' },
    ]);
  });
});

describe('getSystemPermissionRows', () => {
  const systemPermissionMap: Record<string, SystemPermissionDefinitionMap> = {
    // insertion order intentionally not alphabetical to verify sorting
    PermissionsModifyAllData: {
      apiName: 'PermissionsModifyAllData',
      label: 'Modify All Data',
      permissionKeys: ['P1', 'P2'],
      permissions: { P1: { enabled: false }, P2: { enabled: true } },
    },
    PermissionsApiEnabled: {
      apiName: 'PermissionsApiEnabled',
      label: 'API Enabled',
      permissionKeys: ['P1', 'P2'],
      permissions: { P1: { enabled: true }, P2: { enabled: false } },
    },
  };

  it('returns one row per permission, sorted by label', () => {
    const rows = getSystemPermissionRows(systemPermissionMap);
    expect(rows.map((row) => row.apiName)).toEqual(['PermissionsApiEnabled', 'PermissionsModifyAllData']);
  });

  it('builds cells keyed by parent id with the loaded value and clean dirty flags', () => {
    const [apiEnabledRow] = getSystemPermissionRows(systemPermissionMap);

    expect(apiEnabledRow.key).toBe('PermissionsApiEnabled');
    expect(apiEnabledRow.tableLabel).toBe('API Enabled (PermissionsApiEnabled)');
    expect(apiEnabledRow.permissions.P1).toMatchObject({
      parentId: 'P1',
      field: 'PermissionsApiEnabled',
      enabled: true,
      enabledIsDirty: false,
    });
    expect(apiEnabledRow.permissions.P2.enabled).toBe(false);
  });
});

describe('getDirtySystemPermissions', () => {
  it('returns only the cells that are dirty', () => {
    const dirtyRows: Record<string, DirtyRow<PermissionTableSystemPermissionCell>> = {
      PermissionsApiEnabled: {
        rowKey: 'PermissionsApiEnabled',
        dirtyCount: 1,
        row: {
          key: 'PermissionsApiEnabled',
          sobject: 'PermissionsApiEnabled',
          apiName: 'PermissionsApiEnabled',
          label: 'API Enabled',
          tableLabel: 'API Enabled (PermissionsApiEnabled)',
          permissions: {
            P1: buildCellPermission('P1', 'PermissionsApiEnabled', true, true),
            P2: buildCellPermission('P2', 'PermissionsApiEnabled', false, false),
          },
        },
      },
    };

    const dirty = getDirtySystemPermissions(dirtyRows);
    expect(dirty).toHaveLength(1);
    expect(dirty[0].parentId).toBe('P1');
  });
});

describe('prepareSystemPermissionSaveData', () => {
  it('groups permission-set changes into one PermissionSet update record per parent id', () => {
    const dirtyPermissions = [
      buildCellPermission('P1', 'PermissionsApiEnabled', true),
      buildCellPermission('P1', 'PermissionsModifyAllData', false),
      buildCellPermission('P2', 'PermissionsApiEnabled', true),
    ];

    const { recordsToUpdate } = prepareSystemPermissionSaveData(dirtyPermissions, {}, {});
    expect(recordsToUpdate).toHaveLength(2);

    const first = recordsToUpdate.find((item) => item.parentId === 'P1');
    expect(first?.sobjectType).toBe('PermissionSet');
    expect(first?.record).toEqual({
      attributes: { type: 'PermissionSet' },
      Id: 'P1',
      PermissionsApiEnabled: true,
      PermissionsModifyAllData: false,
    });
    expect(first?.dirtyPermissions).toHaveLength(2);

    const second = recordsToUpdate.find((item) => item.parentId === 'P2');
    expect(second?.sobjectType).toBe('PermissionSet');
    expect(second?.record).toEqual({
      attributes: { type: 'PermissionSet' },
      Id: 'P2',
      PermissionsApiEnabled: true,
    });
    expect(second?.dirtyPermissions).toHaveLength(1);
  });

  it('writes profile-owned changes to the Profile record by ProfileId', () => {
    const ownedPermissionSetId = '0PSowned';
    const dirtyPermissions = [buildCellPermission(ownedPermissionSetId, 'PermissionsViewPayments', true)];
    const profilesById: Record<string, PermissionSetWithProfileRecord> = {
      [ownedPermissionSetId]: { ProfileId: '00eProfileId', Profile: { Name: 'Admin' } } as unknown as PermissionSetWithProfileRecord,
    };

    const { recordsToUpdate } = prepareSystemPermissionSaveData(dirtyPermissions, profilesById, {});
    expect(recordsToUpdate).toHaveLength(1);
    expect(recordsToUpdate[0].sobjectType).toBe('Profile');
    // Profile record is targeted by the profile Id, not the owned permission set id
    expect(recordsToUpdate[0].record).toEqual({
      attributes: { type: 'Profile' },
      Id: '00eProfileId',
      PermissionsViewPayments: true,
    });
  });
});

describe('system permission dependency closures', () => {
  // Author Apex requires View Setup + Modify Metadata; Modify Metadata itself requires View Setup.
  it('expands transitive required-closure', () => {
    expect(SYSTEM_PERMISSION_REQUIRED_CLOSURE['PermissionsAuthorApex']).toEqual(
      expect.arrayContaining(['PermissionsViewSetup', 'PermissionsModifyMetadata']),
    );
  });

  it('builds the inverse dependent-closure', () => {
    expect(SYSTEM_PERMISSION_DEPENDENT_CLOSURE['PermissionsViewSetup']).toEqual(
      expect.arrayContaining(['PermissionsAuthorApex', 'PermissionsModifyMetadata']),
    );
  });
});

describe('applySystemPermissionDependencies', () => {
  it('enables required permissions in the same column when a permission is enabled', () => {
    const prevRows = [
      buildSystemRow('PermissionsAuthorApex', { P1: false, P2: false }),
      buildSystemRow('PermissionsViewSetup', { P1: false, P2: false }),
      buildSystemRow('PermissionsModifyMetadata', { P1: false, P2: false }),
    ];
    // user enables Author Apex for P1 only
    const changed = buildSystemRow('PermissionsAuthorApex', { P1: true, P2: false }, { P1: false, P2: false });

    const { rows, affectedKeys } = applySystemPermissionDependencies(prevRows, [changed]);
    const byKey = groupByFlat(rows, 'key');

    expect(byKey['PermissionsViewSetup'].permissions.P1.enabled).toBe(true);
    expect(byKey['PermissionsViewSetup'].permissions.P1.enabledIsDirty).toBe(true);
    expect(byKey['PermissionsModifyMetadata'].permissions.P1.enabled).toBe(true);
    // other column untouched
    expect(byKey['PermissionsViewSetup'].permissions.P2.enabled).toBe(false);
    expect(affectedKeys.has('PermissionsViewSetup')).toBe(true);
    expect(affectedKeys.has('PermissionsModifyMetadata')).toBe(true);
  });

  it('disables dependent permissions in the same column when a required permission is disabled', () => {
    const prevRows = [
      buildSystemRow('PermissionsAuthorApex', { P1: true }, { P1: true }),
      buildSystemRow('PermissionsViewSetup', { P1: true }, { P1: true }),
      buildSystemRow('PermissionsModifyMetadata', { P1: true }, { P1: true }),
    ];
    // user disables View Setup for P1
    const changed = buildSystemRow('PermissionsViewSetup', { P1: false }, { P1: true });

    const { rows } = applySystemPermissionDependencies(prevRows, [changed]);
    const byKey = groupByFlat(rows, 'key');

    expect(byKey['PermissionsAuthorApex'].permissions.P1.enabled).toBe(false);
    expect(byKey['PermissionsModifyMetadata'].permissions.P1.enabled).toBe(false);
    expect(byKey['PermissionsAuthorApex'].permissions.P1.enabledIsDirty).toBe(true);
  });

  it('does not mutate the previous rows', () => {
    const prevRows = [
      buildSystemRow('PermissionsAuthorApex', { P1: false }),
      buildSystemRow('PermissionsViewSetup', { P1: false }),
      buildSystemRow('PermissionsModifyMetadata', { P1: false }),
    ];
    const changed = buildSystemRow('PermissionsAuthorApex', { P1: true }, { P1: false });

    applySystemPermissionDependencies(prevRows, [changed]);

    // original prev rows are untouched (cascade cloned instead of mutating)
    expect(prevRows[1].permissions.P1.enabled).toBe(false);
    expect(prevRows[2].permissions.P1.enabled).toBe(false);
  });
});
