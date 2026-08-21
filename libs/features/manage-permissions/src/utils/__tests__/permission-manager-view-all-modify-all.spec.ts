import {
  BulkActionCheckbox,
  ObjectPermissionDefinitionMap,
  ObjectPermissionItem,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
} from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { OBJECTS_WITHOUT_VIEW_ALL_MODIFY_ALL, supportsViewAllModifyAll } from '../object-permission-support';
import { getObjectRows, updateRowsFromColumnAction, updateRowsFromRowAction } from '../permission-manager-table-utils';
import { filterPermissionRows } from '../permission-manager-utils';

const PARENT_ID = 'permSet1';

function buildPermissionItem(overrides: Partial<ObjectPermissionItem> = {}): ObjectPermissionItem {
  return { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false, viewAllFields: false, ...overrides };
}

function buildPermissionMap(apiName: string): Record<string, ObjectPermissionDefinitionMap> {
  return {
    [apiName]: {
      apiName,
      label: apiName,
      metadata: '',
      supportsObjectPermissions: true,
      permissionKeys: [PARENT_ID],
      permissions: { [PARENT_ID]: buildPermissionItem() },
    },
  };
}

function buildRow(apiName: string, permissionOverrides: Partial<PermissionTableObjectCellPermission> = {}): PermissionTableObjectCell {
  const record = buildPermissionItem();
  return {
    key: apiName,
    sobject: apiName,
    apiName,
    label: apiName,
    tableLabel: `${apiName} (${apiName})`,
    allowEditPermission: true,
    allowViewAllModifyAllPermission: supportsViewAllModifyAll(apiName),
    allowObjectPermission: true,
    permissions: {
      [PARENT_ID]: {
        rowKey: apiName,
        parentId: PARENT_ID,
        sobject: apiName,
        record,
        create: false,
        read: false,
        edit: false,
        delete: false,
        viewAll: false,
        modifyAll: false,
        viewAllFields: false,
        createIsDirty: false,
        readIsDirty: false,
        editIsDirty: false,
        deleteIsDirty: false,
        viewAllIsDirty: false,
        modifyAllIsDirty: false,
        viewAllFieldsIsDirty: false,
        ...permissionOverrides,
      },
    },
  };
}

function allCheckboxesOn(): Record<string, BulkActionCheckbox> {
  return ['create', 'read', 'edit', 'delete', 'viewAll', 'modifyAll', 'viewAllFields'].reduce<Record<string, BulkActionCheckbox>>(
    (output, id) => {
      output[id] = { id: id as BulkActionCheckbox['id'], label: id, value: true, disabled: false };
      return output;
    },
    {},
  );
}

describe('supportsViewAllModifyAll', () => {
  it.each(['Idea', 'PendingOrdSumProcEvent', 'Pricebook2', 'Product2', 'PushTopic'])('reports %s as unsupported', (apiName) => {
    expect(supportsViewAllModifyAll(apiName)).toBe(false);
    expect(OBJECTS_WITHOUT_VIEW_ALL_MODIFY_ALL.has(apiName)).toBe(true);
  });

  it.each(['Account', 'Contact', 'PricebookEntry', 'Custom__c'])('reports %s as supported', (apiName) => {
    expect(supportsViewAllModifyAll(apiName)).toBe(true);
  });
});

describe('getObjectRows', () => {
  it('flags rows for objects that do not support View All / Modify All', () => {
    const [row] = getObjectRows(['Product2'], buildPermissionMap('Product2'));

    expect(row.allowViewAllModifyAllPermission).toBe(false);
  });

  it('leaves supported objects editable', () => {
    const [row] = getObjectRows(['Account'], buildPermissionMap('Account'));

    expect(row.allowViewAllModifyAllPermission).toBe(true);
  });
});

describe('updateRowsFromColumnAction', () => {
  it.each(['viewAll', 'modifyAll'] as const)('does not select %s on an unsupported object', (which) => {
    const rows = [buildRow('Product2'), buildRow('Account')];

    const [product, account] = updateRowsFromColumnAction('object', 'selectAll', which, PARENT_ID, rows);

    expect(product.permissions[PARENT_ID][which]).toBe(false);
    expect(product.permissions[PARENT_ID][`${which}IsDirty`]).toBe(false);
    expect(account.permissions[PARENT_ID][which]).toBe(true);
  });

  it('still applies other permissions to unsupported objects', () => {
    const [product] = updateRowsFromColumnAction('object', 'selectAll', 'read', PARENT_ID, [buildRow('Product2')]);

    expect(product.permissions[PARENT_ID].read).toBe(true);
  });

  it('still allows reset on unsupported objects so a stale value can be restored', () => {
    const rows = [buildRow('Product2', { viewAll: true, viewAllIsDirty: true })];

    const [product] = updateRowsFromColumnAction('object', 'reset', 'viewAll', PARENT_ID, rows);

    expect(product.permissions[PARENT_ID].viewAll).toBe(false);
    expect(product.permissions[PARENT_ID].viewAllIsDirty).toBe(false);
  });
});

describe('updateRowsFromRowAction', () => {
  it('applies every permission except View All / Modify All to unsupported objects', () => {
    const [product, account] = updateRowsFromRowAction('object', allCheckboxesOn(), [buildRow('Product2'), buildRow('Account')]);

    expect(product.permissions[PARENT_ID]).toMatchObject({ create: true, read: true, edit: true, delete: true, viewAllFields: true });
    expect(product.permissions[PARENT_ID].viewAll).toBe(false);
    expect(product.permissions[PARENT_ID].modifyAll).toBe(false);
    expect(account.permissions[PARENT_ID].viewAll).toBe(true);
    expect(account.permissions[PARENT_ID].modifyAll).toBe(true);
  });
});

describe('filterPermissionRows', () => {
  const rows = [buildRow('Account'), buildRow('Contact', { errorMessage: 'Something went wrong' }), buildRow('Lead')];

  it('returns every row with no filters applied', () => {
    expect(filterPermissionRows(rows, '', false)).toHaveLength(3);
  });

  it('keeps only rows with an error when errorsOnly is set', () => {
    expect(filterPermissionRows(rows, '', true)?.map(({ apiName }) => apiName)).toEqual(['Contact']);
  });

  it('applies the text filter and errorsOnly together', () => {
    expect(filterPermissionRows(rows, 'Account', true)).toEqual([]);
    expect(filterPermissionRows(rows, 'Contact', true)?.map(({ apiName }) => apiName)).toEqual(['Contact']);
  });

  it('returns null when there are no rows yet', () => {
    expect(filterPermissionRows(null, '', false)).toBeNull();
  });
});
