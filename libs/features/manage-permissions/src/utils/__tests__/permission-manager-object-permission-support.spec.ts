import {
  BulkActionCheckbox,
  ObjectPermissionDefinitionMap,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
} from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { getObjectColumns, getObjectRows, updateRowsFromColumnAction, updateRowsFromRowAction } from '../permission-manager-table-utils';

/**
 * Objects such as PricebookEntry and Task accept `FieldPermissions` but have no `ObjectPermissions`
 * record, so they belong in the object picker (for their fields) while the object permission table has
 * nothing for the user to set.
 */

const PARENT_ID = '0PS1t000000PermSet';

function buildPermissionMap(apiName: string, supportsObjectPermissions: boolean): Record<string, ObjectPermissionDefinitionMap> {
  return {
    [apiName]: {
      apiName,
      label: apiName,
      metadata: '',
      supportsObjectPermissions,
      permissionKeys: [PARENT_ID],
      permissions: {
        [PARENT_ID]: { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false, viewAllFields: false },
      },
    },
  };
}

describe('getObjectRows', () => {
  it.each([
    ['Account', true],
    ['PricebookEntry', false],
  ])('carries supportsObjectPermissions onto the %s row', (apiName, supportsObjectPermissions) => {
    const [row] = getObjectRows([apiName], buildPermissionMap(apiName, supportsObjectPermissions));

    expect(row.allowObjectPermission).toBe(supportsObjectPermissions);
  });
});

describe('object permission columns', () => {
  const columns = getObjectColumns([], [PARENT_ID], {} as Record<string, PermissionSetWithProfileRecord>, {
    [PARENT_ID]: { Label: 'Sales User', Name: 'Sales_User' } as PermissionSetNoProfileRecord,
  });
  const permissionColumns = columns.filter((column) => column.key.startsWith(PARENT_ID));

  it.each([
    ['Account', true],
    ['PricebookEntry', false],
  ])('makes every permission cell editable=%s for %s', (apiName, supportsObjectPermissions) => {
    const [row] = getObjectRows([apiName], buildPermissionMap(apiName, supportsObjectPermissions));

    permissionColumns.forEach((column) => {
      expect(typeof column.editable === 'function' && column.editable(row)).toBe(supportsObjectPermissions);
    });
  });

  it('greys the object label when object permissions cannot be set', () => {
    const [labelColumn] = columns;
    const [supported] = getObjectRows(['Account'], buildPermissionMap('Account', true));
    const [unsupported] = getObjectRows(['PricebookEntry'], buildPermissionMap('PricebookEntry', false));

    expect(typeof labelColumn.cellClass === 'function' && labelColumn.cellClass(supported)).toBeUndefined();
    expect(typeof labelColumn.cellClass === 'function' && labelColumn.cellClass(unsupported)).toBe('slds-text-color_weak');
  });
});

/**
 * Bulk/row actions must respect the same `allowObjectPermission` guard as per-cell editing, otherwise
 * "Select All" / "Edit Row" / "Edit All" can save ObjectPermissions on objects Salesforce rejects.
 */
describe('bulk/row actions respect allowObjectPermission', () => {
  it('updateRowsFromColumnAction leaves an unsupported row untouched on selectAll', () => {
    const [unsupported] = getObjectRows(['PricebookEntry'], buildPermissionMap('PricebookEntry', false));

    const [updated] = updateRowsFromColumnAction('object', 'selectAll', 'create', PARENT_ID, [unsupported]);

    expect(updated.permissions[PARENT_ID].create).toBe(false);
    expect(updated.permissions[PARENT_ID].createIsDirty).toBe(false);
  });

  it('updateRowsFromRowAction leaves an unsupported row untouched', () => {
    const [unsupported] = getObjectRows(['PricebookEntry'], buildPermissionMap('PricebookEntry', false));
    const checkboxesById: Record<string, BulkActionCheckbox> = {
      create: { id: 'create', label: 'Create', value: true, disabled: false },
      read: { id: 'read', label: 'Read', value: true, disabled: false },
      edit: { id: 'edit', label: 'Edit', value: true, disabled: false },
      delete: { id: 'delete', label: 'Delete', value: true, disabled: false },
      viewAll: { id: 'viewAll', label: 'View All', value: true, disabled: false },
      modifyAll: { id: 'modifyAll', label: 'Modify All', value: true, disabled: false },
      viewAllFields: { id: 'viewAllFields', label: 'View All Fields', value: true, disabled: false },
    };

    const [updated] = updateRowsFromRowAction('object', checkboxesById, [unsupported]);

    expect(updated.permissions[PARENT_ID]).toMatchObject({
      create: false,
      read: false,
      edit: false,
      delete: false,
      viewAll: false,
      modifyAll: false,
      viewAllFields: false,
    });
  });

  it('updateRowsFromColumnAction and updateRowsFromRowAction still apply to a supported row', () => {
    const [supported] = getObjectRows(['Account'], buildPermissionMap('Account', true));

    const [updatedFromColumn] = updateRowsFromColumnAction('object', 'selectAll', 'create', PARENT_ID, [supported]);
    expect(updatedFromColumn.permissions[PARENT_ID].create).toBe(true);

    const checkboxesById: Record<string, BulkActionCheckbox> = {
      create: { id: 'create', label: 'Create', value: true, disabled: false },
      read: { id: 'read', label: 'Read', value: true, disabled: false },
      edit: { id: 'edit', label: 'Edit', value: true, disabled: false },
      delete: { id: 'delete', label: 'Delete', value: true, disabled: false },
      viewAll: { id: 'viewAll', label: 'View All', value: true, disabled: false },
      modifyAll: { id: 'modifyAll', label: 'Modify All', value: true, disabled: false },
      viewAllFields: { id: 'viewAllFields', label: 'View All Fields', value: true, disabled: false },
    };
    const [updatedFromRow] = updateRowsFromRowAction('object', checkboxesById, [supported]);
    expect(updatedFromRow.permissions[PARENT_ID].create).toBe(true);
  });
});
