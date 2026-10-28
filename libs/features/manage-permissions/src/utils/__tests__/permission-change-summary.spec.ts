import {
  DirtyRow,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  PermissionTableFieldCell,
  PermissionTableObjectCell,
  PermissionTableSetupEntityAccessCell,
  PermissionTableSystemPermissionCell,
  PermissionTableTabVisibilityCell,
} from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { getPermissionChangeSections, getPermissionChangeTotals } from '../permission-change-summary';

const PROFILE_ID = '0PS000000000001AAA';
const PERM_SET_ID = '0PS000000000002AAA';
const MANAGED_PERM_SET_ID = '0PS000000000003AAA';

const profilesById = { [PROFILE_ID]: { Id: PROFILE_ID, Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord };
const permissionSetsById = {
  [PERM_SET_ID]: { Id: PERM_SET_ID, Name: 'Sales_Ops' } as PermissionSetNoProfileRecord,
  [MANAGED_PERM_SET_ID]: { Id: MANAGED_PERM_SET_ID, Name: 'SBQQ__CPQ_Admin' } as PermissionSetNoProfileRecord,
};

function dirty<T extends { key: string }>(row: T): Record<string, DirtyRow<T>> {
  return { [row.key]: { rowKey: row.key, dirtyCount: 1, row } };
}

const objectRow = {
  key: 'Account',
  sobject: 'Account',
  apiName: 'Account',
  label: 'Account',
  tableLabel: 'Account',
  permissions: {
    [PROFILE_ID]: {
      parentId: PROFILE_ID,
      isReadOnly: false,
      read: true,
      readIsDirty: true,
      edit: true,
      editIsDirty: true,
      delete: false,
      deleteIsDirty: true,
      create: false,
      createIsDirty: false,
      viewAll: false,
      viewAllIsDirty: false,
      modifyAll: false,
      modifyAllIsDirty: false,
      viewAllFields: false,
      viewAllFieldsIsDirty: false,
    },
    // untouched parent is skipped
    [PERM_SET_ID]: { parentId: PERM_SET_ID, isReadOnly: false, readIsDirty: false, editIsDirty: false },
  },
} as unknown as PermissionTableObjectCell;

const fieldRow = {
  key: 'Account.Industry',
  sobject: 'Account',
  apiName: 'Industry',
  label: 'Industry',
  tableLabel: 'Industry (Industry)',
  permissions: {
    [PERM_SET_ID]: { parentId: PERM_SET_ID, isReadOnly: false, read: true, readIsDirty: false, edit: false, editIsDirty: true },
    // read-only (managed) cells are never saved, so they are not listed even if flagged dirty
    [MANAGED_PERM_SET_ID]: {
      parentId: MANAGED_PERM_SET_ID,
      isReadOnly: true,
      read: true,
      readIsDirty: true,
      edit: true,
      editIsDirty: true,
    },
  },
} as unknown as PermissionTableFieldCell;

const tabRow = {
  key: 'Account',
  sobject: 'Account',
  permissions: {
    [PROFILE_ID]: { parentId: PROFILE_ID, isReadOnly: false, available: true, availableIsDirty: true, visible: true, visibleIsDirty: true },
  },
} as unknown as PermissionTableTabVisibilityCell;

const systemRow = {
  key: 'PermissionsApiEnabled',
  apiName: 'PermissionsApiEnabled',
  label: 'API Enabled',
  permissions: { [PERM_SET_ID]: { parentId: PERM_SET_ID, isReadOnly: false, enabled: false, enabledIsDirty: true } },
} as unknown as PermissionTableSystemPermissionCell;

const customPermissionRow = {
  key: '0CP000000000001AAA',
  apiName: 'Approve_Discounts',
  label: 'Approve Discounts',
  permissions: { [PROFILE_ID]: { parentId: PROFILE_ID, isReadOnly: false, enabled: true, enabledIsDirty: true } },
} as unknown as PermissionTableSetupEntityAccessCell;

describe('getPermissionChangeSections', () => {
  const sections = getPermissionChangeSections({
    dirtyObjectRows: dirty(objectRow),
    dirtyFieldRows: dirty(fieldRow),
    dirtyTabVisibilityRows: dirty(tabRow),
    dirtySystemPermissionRows: dirty(systemRow),
    dirtySetupEntityAccessRows: [{ title: 'Custom Permissions', itemHeader: 'Custom Permission', dirtyRows: dirty(customPermissionRow) }],
    profilesById,
    permissionSetsById,
  });

  it('should produce one section per tab with changes, in tab order', () => {
    expect(sections.map(({ title }) => title)).toEqual([
      'Object Permissions',
      'Tab Visibility',
      'Field Permissions',
      'System Permissions',
      'Custom Permissions',
    ]);
  });

  it('should list only the changed flags of each dirty cell, with the value that will be saved', () => {
    const [objectSection] = sections;
    expect(objectSection.changes).toEqual([
      {
        key: `Account-${PROFILE_ID}`,
        itemLabel: 'Account',
        itemDetail: undefined,
        parentId: PROFILE_ID,
        parentLabel: 'System Administrator',
        parentType: 'Profile',
        flags: [
          { label: 'Read', enabled: true },
          { label: 'Edit', enabled: true },
          { label: 'Delete', enabled: false },
        ],
      },
    ]);
  });

  it('should skip read-only cells and describe fields, system and custom permissions with their API names', () => {
    const fieldSection = sections.find(({ key }) => key === 'field');
    expect(fieldSection?.changes).toEqual([
      expect.objectContaining({
        itemLabel: 'Industry',
        itemDetail: 'Account.Industry',
        parentLabel: 'Sales_Ops',
        parentType: 'Permission Set',
        flags: [{ label: 'Edit', enabled: false }],
      }),
    ]);
    expect(sections.find(({ key }) => key === 'tabVisibility')?.changes[0].flags).toEqual([
      { label: 'Available', enabled: true },
      { label: 'Visible', enabled: true },
    ]);
    expect(sections.find(({ key }) => key === 'systemPermission')?.changes[0]).toMatchObject({
      itemLabel: 'API Enabled',
      itemDetail: 'PermissionsApiEnabled',
      flags: [{ label: 'Enabled', enabled: false }],
    });
    expect(sections.find(({ key }) => key === 'setupEntityAccess-0')?.changes[0]).toMatchObject({
      itemLabel: 'Approve Discounts',
      itemDetail: 'Approve_Discounts',
      parentLabel: 'System Administrator',
      flags: [{ label: 'Granted', enabled: true }],
    });
  });

  it('should drop tabs without changes', () => {
    const onlyFields = getPermissionChangeSections({
      dirtyObjectRows: {},
      dirtyFieldRows: dirty(fieldRow),
      dirtyTabVisibilityRows: {},
      dirtySystemPermissionRows: {},
      dirtySetupEntityAccessRows: [{ title: 'Custom Permissions', itemHeader: 'Custom Permission', dirtyRows: {} }],
      profilesById,
      permissionSetsById,
    });
    expect(onlyFields.map(({ key }) => key)).toEqual(['field']);
  });

  it('should total changes and distinct profiles / permission sets', () => {
    expect(getPermissionChangeTotals(sections)).toEqual({ changeCount: 5, profileCount: 1, permissionSetCount: 1 });
  });
});
