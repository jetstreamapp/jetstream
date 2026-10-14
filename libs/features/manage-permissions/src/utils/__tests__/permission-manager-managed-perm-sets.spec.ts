import { isManagedPermissionSet } from '@jetstream/shared/ui-utils';
import {
  BulkActionCheckbox,
  ObjectPermissionDefinitionMap,
  ObjectPermissionItem,
  PermissionSetRecord,
  PermissionTableObjectCell,
} from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  applyPastedPermissionCells,
  getObjectColumns,
  getObjectRows,
  resetRow,
  updateRowsFromColumnAction,
  updateRowsFromRowAction,
} from '../permission-manager-table-utils';

/**
 * The editable permission set and the managed one sit side by side on every row, so each test can assert
 * that an action lands on one and leaves the other untouched.
 */
const EDITABLE_ID = '0PSeditable';
const MANAGED_ID = '0PSmanaged';
const READ_ONLY_IDS: ReadonlySet<string> = new Set([MANAGED_ID]);
const SOBJECT = 'Account';

function buildPermissionItem(isReadOnly: boolean): ObjectPermissionItem {
  return {
    create: false,
    read: false,
    edit: false,
    delete: false,
    viewAll: false,
    modifyAll: false,
    viewAllFields: false,
    isReadOnly,
  };
}

function buildPermissionMap(): Record<string, ObjectPermissionDefinitionMap> {
  return {
    [SOBJECT]: {
      apiName: SOBJECT,
      label: SOBJECT,
      metadata: '',
      supportsObjectPermissions: true,
      permissionKeys: [EDITABLE_ID, MANAGED_ID],
      permissions: {
        [EDITABLE_ID]: buildPermissionItem(false),
        [MANAGED_ID]: buildPermissionItem(true),
      },
    },
  };
}

function buildRow(): PermissionTableObjectCell {
  return getObjectRows([SOBJECT], buildPermissionMap())[0];
}

function allCheckboxesOn(): Record<string, BulkActionCheckbox> {
  return (['create', 'read', 'edit', 'delete', 'viewAll', 'modifyAll', 'viewAllFields'] as const).reduce(
    (output: Record<string, BulkActionCheckbox>, id) => {
      output[id] = { id, label: id, value: true, disabled: false };
      return output;
    },
    {},
  );
}

describe('isManagedPermissionSet', () => {
  function buildRecord(namespacePrefix: string | null): PermissionSetRecord {
    return { NamespacePrefix: namespacePrefix } as PermissionSetRecord;
  }

  it('treats a permission set with no namespace as editable', () => {
    expect(isManagedPermissionSet(buildRecord(null), null)).toBe(false);
    expect(isManagedPermissionSet(buildRecord(null), 'myOrgNs')).toBe(false);
  });

  it('treats an installed package namespace as managed', () => {
    expect(isManagedPermissionSet(buildRecord('SBQQ'), null)).toBe(true);
    expect(isManagedPermissionSet(buildRecord('SBQQ'), 'myOrgNs')).toBe(true);
  });

  it("treats the org's own namespace as editable, because the org publishes that package", () => {
    expect(isManagedPermissionSet(buildRecord('myOrgNs'), 'myOrgNs')).toBe(false);
  });

  it('handles a missing record', () => {
    expect(isManagedPermissionSet(undefined, 'myOrgNs')).toBe(false);
  });
});

describe('managed permission set columns are read-only', () => {
  const columns = getObjectColumns([], [EDITABLE_ID, MANAGED_ID], {}, {}, READ_ONLY_IDS);

  function findColumn(permissionSetId: string, actionKey: string) {
    const column = columns.find((col) => col.key === `${permissionSetId}-${actionKey}`);
    if (!column) {
      throw new Error(`No column for ${permissionSetId}-${actionKey}`);
    }
    return column;
  }

  /** `editable` is either a flat boolean or a per-row predicate. */
  function isEditable(permissionSetId: string, actionKey: string, row: PermissionTableObjectCell) {
    const { editable } = findColumn(permissionSetId, actionKey);
    return typeof editable === 'function' ? editable(row) : editable;
  }

  it('marks every managed column as not editable, which is what gates paste and clear', () => {
    const row = buildRow();
    expect(isEditable(MANAGED_ID, 'read', row)).toBe(false);
    expect(isEditable(MANAGED_ID, 'edit', row)).toBe(false);
    expect(isEditable(EDITABLE_ID, 'read', row)).toBe(true);
  });

  it('tints managed cells and leaves editable cells alone', () => {
    const row = buildRow();
    const managedCellClass = findColumn(MANAGED_ID, 'read').cellClass;
    const editableCellClass = findColumn(EDITABLE_ID, 'read').cellClass;
    expect(typeof managedCellClass === 'function' && managedCellClass(row)).toBe('bg-color-gray');
    expect(typeof editableCellClass === 'function' && editableCellClass(row)).toBe('');
  });

  it('flags the managed column group in the export header only', () => {
    expect(findColumn(MANAGED_ID, 'read').name).toContain('[Managed]');
    expect(findColumn(EDITABLE_ID, 'read').name).not.toContain('[Managed]');
  });
});

describe('managed permissions survive every bulk action unchanged', () => {
  it('the row-level and table-wide bulk action skips them', () => {
    const [updated] = updateRowsFromRowAction('object', allCheckboxesOn(), [buildRow()]);

    expect(updated.permissions[EDITABLE_ID].read).toBe(true);
    expect(updated.permissions[EDITABLE_ID].readIsDirty).toBe(true);
    expect(updated.permissions[MANAGED_ID].read).toBe(false);
    expect(updated.permissions[MANAGED_ID].readIsDirty).toBe(false);
  });

  it('a column select-all on the managed column changes nothing', () => {
    const [updated] = updateRowsFromColumnAction('object', 'selectAll', 'read', MANAGED_ID, [buildRow()]);
    expect(updated.permissions[MANAGED_ID].read).toBe(false);
    expect(updated.permissions[MANAGED_ID].readIsDirty).toBe(false);
  });

  it('a column select-all on an editable column still works', () => {
    const [updated] = updateRowsFromColumnAction('object', 'selectAll', 'read', EDITABLE_ID, [buildRow()]);
    expect(updated.permissions[EDITABLE_ID].read).toBe(true);
  });

  it('pasting into a managed column is dropped', () => {
    const [updated] = applyPastedPermissionCells(
      'object',
      [buildRow()],
      [
        { rowKey: SOBJECT, columnKey: `${MANAGED_ID}-read`, value: 'true' },
        { rowKey: SOBJECT, columnKey: `${EDITABLE_ID}-read`, value: 'true' },
      ],
    );

    expect(updated.permissions[MANAGED_ID].read).toBe(false);
    expect(updated.permissions[EDITABLE_ID].read).toBe(true);
  });

  it('resetting a row leaves the managed permission untouched', () => {
    const [updated] = resetRow('object', [buildRow()]);
    expect(updated.permissions[MANAGED_ID].read).toBe(false);
    expect(updated.permissions[MANAGED_ID].isReadOnly).toBe(true);
  });
});
