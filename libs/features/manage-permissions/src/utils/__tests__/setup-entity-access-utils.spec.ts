import {
  DirtyRow,
  PermissionSaveResults,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  PermissionTableSetupEntityAccessCell,
  PermissionTableSetupEntityAccessCellPermission,
  SetupEntityAccessDefinitionMap,
  SetupEntityAccessRecord,
  SetupEntityAccessRecordForSave,
} from '@jetstream/types';
import { parse } from 'papaparse';
import { describe, expect, it } from 'vitest';
import { generateSetupEntityAccessCsv } from '../permission-manager-export-utils';
import {
  getDirtySetupEntityAccessPermissions,
  getSetupEntityAccessColumns,
  getSetupEntityAccessRows,
  updateSetupEntityAccessRowsAfterSave,
} from '../permission-manager-table-utils';
import {
  customPermissionToCatalogItem,
  getQuerySetupEntityAccess,
  getSetupEntityAccessMap,
  getUpdatedSetupEntityAccessPermissions,
  prepareSetupEntityAccessSaveData,
} from '../setup-entity-access-utils';

const PROFILE_PERM_SET_ID = '0PS000000000001AAA';
const PERM_SET_ID = '0PS000000000002AAA';
const MANAGED_PERM_SET_ID = '0PS000000000003AAA';
const READ_ONLY_IDS: ReadonlySet<string> = new Set([MANAGED_PERM_SET_ID]);

const profilesById = {
  [PROFILE_PERM_SET_ID]: { Id: PROFILE_PERM_SET_ID, Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord,
};
const permissionSetsById = {
  [PERM_SET_ID]: { Id: PERM_SET_ID, Name: 'Sales_Ops' } as PermissionSetNoProfileRecord,
  [MANAGED_PERM_SET_ID]: { Id: MANAGED_PERM_SET_ID, Name: 'SBQQ__CPQ_Admin' } as PermissionSetNoProfileRecord,
};

const ORG_PERMISSION = customPermissionToCatalogItem({
  Id: '0CP000000000001AAA',
  DeveloperName: 'Approve_Discounts',
  MasterLabel: 'Approve Discounts',
  NamespacePrefix: null,
  Description: 'Can approve discounts over 20%',
  IsLicensed: false,
  IsProtected: false,
});
const PACKAGED_PERMISSION = customPermissionToCatalogItem({
  Id: '0CP000000000002AAA',
  DeveloperName: 'HideGlobalHeader',
  MasterLabel: 'Hide Global Header',
  NamespacePrefix: 'SBQQ',
  Description: null,
  IsLicensed: false,
  IsProtected: false,
});

function buildAccessRecord(setupEntityId: string, parentId: string, id = `0J0${setupEntityId.slice(3, 10)}${parentId.slice(3, 8)}`) {
  return { Id: id, ParentId: parentId, SetupEntityId: setupEntityId, SetupEntityType: 'CustomPermission' } as SetupEntityAccessRecord;
}

function buildMap(accessRecords: SetupEntityAccessRecord[] = []) {
  return getSetupEntityAccessMap(
    'CustomPermission',
    [ORG_PERMISSION, PACKAGED_PERMISSION],
    [PROFILE_PERM_SET_ID],
    [PERM_SET_ID, MANAGED_PERM_SET_ID],
    accessRecords,
    READ_ONLY_IDS,
  );
}

function buildCellPermission(
  overrides: Partial<PermissionTableSetupEntityAccessCellPermission> & { parentId: string; enabled: boolean },
): PermissionTableSetupEntityAccessCellPermission {
  const record = overrides.record || { enabled: !overrides.enabled, isReadOnly: false, record: null };
  return {
    rowKey: ORG_PERMISSION.setupEntityId,
    sobject: ORG_PERMISSION.apiName,
    setupEntityType: 'CustomPermission',
    setupEntityId: ORG_PERMISSION.setupEntityId,
    enabledIsDirty: true,
    isReadOnly: false,
    ...overrides,
    record,
  };
}

describe('customPermissionToCatalogItem', () => {
  it('should prefix the API name with the namespace for packaged custom permissions', () => {
    expect(ORG_PERMISSION.apiName).toBe('Approve_Discounts');
    expect(PACKAGED_PERMISSION.apiName).toBe('SBQQ__HideGlobalHeader');
    expect(PACKAGED_PERMISSION.label).toBe('Hide Global Header');
  });
});

describe('getQuerySetupEntityAccess', () => {
  it('should filter on the entity type and every selected parent', () => {
    const [query] = getQuerySetupEntityAccess('CustomPermission', [PROFILE_PERM_SET_ID], [PERM_SET_ID]);
    expect(query).toContain(`SetupEntityType = 'CustomPermission'`);
    expect(query).toContain(PROFILE_PERM_SET_ID);
    expect(query).toContain(PERM_SET_ID);
    expect(query).toContain('FROM SetupEntityAccess');
  });

  it('should chunk parents into multiple queries and produce nothing without parents', () => {
    const manyIds = Array.from({ length: 150 }, (_, i) => `0PS${String(i).padStart(12, '0')}AAA`);
    expect(getQuerySetupEntityAccess('CustomPermission', manyIds, [])).toHaveLength(2);
    expect(getQuerySetupEntityAccess('CustomPermission', [], [])).toEqual([]);
  });
});

describe('getSetupEntityAccessMap', () => {
  it('should mark access as enabled only where a row exists and keep the row for later deletes', () => {
    const record = buildAccessRecord(ORG_PERMISSION.setupEntityId, PERM_SET_ID);
    const map = buildMap([record]);

    expect(Object.keys(map)).toEqual([ORG_PERMISSION.setupEntityId, PACKAGED_PERMISSION.setupEntityId]);
    const orgPermission = map[ORG_PERMISSION.setupEntityId];
    expect(orgPermission.permissionKeys).toEqual([PROFILE_PERM_SET_ID, PERM_SET_ID, MANAGED_PERM_SET_ID]);
    expect(orgPermission.permissions[PERM_SET_ID]).toEqual({ enabled: true, record, isReadOnly: false });
    expect(orgPermission.permissions[PROFILE_PERM_SET_ID]).toEqual({ enabled: false, record: null, isReadOnly: false });
    expect(orgPermission.permissions[MANAGED_PERM_SET_ID]).toEqual({ enabled: false, record: null, isReadOnly: true });
    expect(orgPermission.description).toBe('Can approve discounts over 20%');
  });

  it('should treat placeholder rows with an invalid id as granted but without a deletable record', () => {
    const placeholder = buildAccessRecord(ORG_PERMISSION.setupEntityId, PROFILE_PERM_SET_ID, '000000000000000AAA');
    const map = buildMap([placeholder]);
    expect(map[ORG_PERMISSION.setupEntityId].permissions[PROFILE_PERM_SET_ID]).toEqual({ enabled: true, record: null, isReadOnly: false });
  });
});

describe('getSetupEntityAccessRows', () => {
  it('should order org entities before packaged ones and build one cell per parent', () => {
    const map = buildMap([buildAccessRecord(PACKAGED_PERMISSION.setupEntityId, PROFILE_PERM_SET_ID)]);
    const rows = getSetupEntityAccessRows(map);

    expect(rows.map(({ apiName }) => apiName)).toEqual(['Approve_Discounts', 'SBQQ__HideGlobalHeader']);
    const [orgRow, packagedRow] = rows;
    expect(orgRow.key).toBe(ORG_PERMISSION.setupEntityId);
    expect(orgRow.tableLabel).toBe('Approve Discounts (Approve_Discounts)');
    expect(orgRow.permissions[PERM_SET_ID]).toMatchObject({
      parentId: PERM_SET_ID,
      setupEntityId: ORG_PERMISSION.setupEntityId,
      enabled: false,
      enabledIsDirty: false,
      isReadOnly: false,
    });
    expect(packagedRow.permissions[PROFILE_PERM_SET_ID].enabled).toBe(true);
    expect(packagedRow.permissions[MANAGED_PERM_SET_ID].isReadOnly).toBe(true);
  });
});

describe('getSetupEntityAccessColumns', () => {
  it('should build a label column, a row action column and one enabled column per parent', () => {
    const columns = getSetupEntityAccessColumns(
      'Custom Permission',
      [PROFILE_PERM_SET_ID],
      [PERM_SET_ID, MANAGED_PERM_SET_ID],
      profilesById,
      permissionSetsById,
      READ_ONLY_IDS,
    );
    expect(columns.map(({ key }) => key)).toEqual([
      'tableLabel',
      '_ROW_ACTION',
      `${PROFILE_PERM_SET_ID}-enabled`,
      `${PERM_SET_ID}-enabled`,
      `${MANAGED_PERM_SET_ID}-enabled`,
    ]);
    expect(columns[0].name).toBe('Custom Permission');
    expect(columns[2].name).toBe('System Administrator (Profile)');
    expect(columns[4].name).toBe('SBQQ__CPQ_Admin (Permission Set) [Managed]');
  });
});

describe('prepareSetupEntityAccessSaveData', () => {
  it('should insert for new grants, delete for revoked rows and skip revokes with nothing to delete', () => {
    const existingRecord = buildAccessRecord(ORG_PERMISSION.setupEntityId, PERM_SET_ID);
    const grant = buildCellPermission({ parentId: PROFILE_PERM_SET_ID, enabled: true });
    const revoke = buildCellPermission({
      parentId: PERM_SET_ID,
      enabled: false,
      record: { enabled: true, isReadOnly: false, record: existingRecord },
    });
    const revokeWithoutRow = buildCellPermission({
      parentId: MANAGED_PERM_SET_ID,
      enabled: false,
      record: { enabled: true, isReadOnly: false, record: null },
    });

    const saveData = prepareSetupEntityAccessSaveData([grant, revoke, revokeWithoutRow]);

    expect(saveData.recordsToInsert).toEqual([
      { attributes: { type: 'SetupEntityAccess' }, ParentId: PROFILE_PERM_SET_ID, SetupEntityId: ORG_PERMISSION.setupEntityId },
    ]);
    expect(saveData.recordsToUpdate).toEqual([]);
    expect(saveData.recordsToDelete).toEqual([existingRecord.Id]);
    expect(saveData.permissionSaveResults).toEqual([
      { dirtyPermission: grant, dirtyPermissionIdx: 0, operation: 'insert', record: saveData.recordsToInsert[0], recordIdx: 0 },
      { dirtyPermission: revoke, dirtyPermissionIdx: 1, operation: 'delete', record: undefined, recordIdx: 0 },
    ]);
  });
});

describe('getDirtySetupEntityAccessPermissions', () => {
  it('should collect dirty cells and never include read-only ones', () => {
    const dirtyCell = buildCellPermission({ parentId: PROFILE_PERM_SET_ID, enabled: true });
    const cleanCell = buildCellPermission({ parentId: PERM_SET_ID, enabled: false, enabledIsDirty: false });
    const readOnlyDirtyCell = buildCellPermission({ parentId: MANAGED_PERM_SET_ID, enabled: true, isReadOnly: true });
    const row: PermissionTableSetupEntityAccessCell = {
      key: ORG_PERMISSION.setupEntityId,
      sobject: ORG_PERMISSION.apiName,
      apiName: ORG_PERMISSION.apiName,
      label: ORG_PERMISSION.label,
      tableLabel: ORG_PERMISSION.label,
      setupEntityType: 'CustomPermission',
      setupEntityId: ORG_PERMISSION.setupEntityId,
      permissions: { [PROFILE_PERM_SET_ID]: dirtyCell, [PERM_SET_ID]: cleanCell, [MANAGED_PERM_SET_ID]: readOnlyDirtyCell },
    };
    const dirtyRows: Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>> = {
      [row.key]: { rowKey: row.key, dirtyCount: 2, row },
    };

    expect(getDirtySetupEntityAccessPermissions(dirtyRows)).toEqual([dirtyCell]);
  });
});

describe('getUpdatedSetupEntityAccessPermissions + updateSetupEntityAccessRowsAfterSave', () => {
  it('should store the new row on insert, drop it on delete and attach errors on failure', () => {
    const existingRecord = buildAccessRecord(ORG_PERMISSION.setupEntityId, PERM_SET_ID);
    const map = buildMap([existingRecord]);
    const grant = buildCellPermission({ parentId: PROFILE_PERM_SET_ID, enabled: true });
    const revoke = buildCellPermission({
      parentId: PERM_SET_ID,
      enabled: false,
      record: { enabled: true, isReadOnly: false, record: existingRecord },
    });
    const failedGrant = buildCellPermission({
      parentId: PROFILE_PERM_SET_ID,
      enabled: true,
      rowKey: PACKAGED_PERMISSION.setupEntityId,
      setupEntityId: PACKAGED_PERMISSION.setupEntityId,
      sobject: PACKAGED_PERMISSION.apiName,
    });
    const results: PermissionSaveResults<SetupEntityAccessRecordForSave, PermissionTableSetupEntityAccessCellPermission>[] = [
      { dirtyPermission: grant, dirtyPermissionIdx: 0, operation: 'insert', recordIdx: 0, response: { id: '0J0NEW', success: true } },
      {
        dirtyPermission: revoke,
        dirtyPermissionIdx: 1,
        operation: 'delete',
        recordIdx: 0,
        response: { id: existingRecord.Id, success: true },
      },
      {
        dirtyPermission: failedGrant,
        dirtyPermissionIdx: 2,
        operation: 'insert',
        recordIdx: 1,
        response: { success: false, errors: [{ statusCode: 'INSUFFICIENT_ACCESS', message: 'insufficient access rights', fields: [] }] },
      },
    ];

    const updatedMap = getUpdatedSetupEntityAccessPermissions(map, results);

    expect(updatedMap[ORG_PERMISSION.setupEntityId].permissions[PROFILE_PERM_SET_ID]).toEqual({
      enabled: true,
      isReadOnly: false,
      errorMessage: undefined,
      record: {
        Id: '0J0NEW',
        ParentId: PROFILE_PERM_SET_ID,
        SetupEntityId: ORG_PERMISSION.setupEntityId,
        SetupEntityType: 'CustomPermission',
      },
    });
    expect(updatedMap[ORG_PERMISSION.setupEntityId].permissions[PERM_SET_ID]).toEqual({
      enabled: false,
      isReadOnly: false,
      errorMessage: undefined,
      record: null,
    });
    expect(updatedMap[PACKAGED_PERMISSION.setupEntityId].permissions[PROFILE_PERM_SET_ID]).toMatchObject({
      enabled: false,
      errorMessage: 'insufficient access rights',
    });
    // the input map is not mutated
    expect(map[ORG_PERMISSION.setupEntityId].permissions[PROFILE_PERM_SET_ID].enabled).toBe(false);

    const rows = updateSetupEntityAccessRowsAfterSave(getSetupEntityAccessRows(map), updatedMap);
    const [orgRow, packagedRow] = rows;
    expect(orgRow.permissions[PROFILE_PERM_SET_ID]).toMatchObject({ enabled: true, enabledIsDirty: false });
    expect(orgRow.permissions[PROFILE_PERM_SET_ID].record.record?.Id).toBe('0J0NEW');
    expect(orgRow.permissions[PERM_SET_ID]).toMatchObject({ enabled: false, enabledIsDirty: false });
    expect(packagedRow.permissions[PROFILE_PERM_SET_ID].errorMessage).toBe('insufficient access rights');
  });
});

describe('generateSetupEntityAccessCsv', () => {
  it('should write one column per parent after the descriptive columns', () => {
    const map: Record<string, SetupEntityAccessDefinitionMap> = buildMap([buildAccessRecord(ORG_PERMISSION.setupEntityId, PERM_SET_ID)]);
    const columns = getSetupEntityAccessColumns(
      'Custom Permission',
      [PROFILE_PERM_SET_ID],
      [PERM_SET_ID, MANAGED_PERM_SET_ID],
      profilesById,
      permissionSetsById,
      READ_ONLY_IDS,
    );
    const csv = generateSetupEntityAccessCsv('Custom Permission', columns, getSetupEntityAccessRows(map));
    const [header, orgRow, packagedRow] = parse<string[]>(csv).data;

    expect(header).toEqual([
      'Custom Permission',
      'API Name',
      'Namespace',
      'Description',
      'System Administrator (Profile)',
      'Sales_Ops (Permission Set)',
      'SBQQ__CPQ_Admin (Permission Set) [Managed]',
    ]);
    expect(orgRow).toEqual(['Approve Discounts', 'Approve_Discounts', '', 'Can approve discounts over 20%', 'FALSE', 'TRUE', 'FALSE']);
    expect(packagedRow).toEqual(['Hide Global Header', 'SBQQ__HideGlobalHeader', 'SBQQ', '', 'FALSE', 'FALSE', 'FALSE']);
  });
});
