import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, PermissionTableFieldCell } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  FieldAuditColumnKey,
  getFieldAuditExportHeaders,
  parseVisibleFieldAuditColumns,
  serializeVisibleFieldAuditColumns,
} from '../permission-manager-field-audit-columns';
import { getFieldColumns } from '../permission-manager-table-utils';

const PROFILE_ID = '0PS1t000000Profile';
const PERM_SET_ID = '0PS1t000000PermSet';

const profilesById = {
  [PROFILE_ID]: { Label: 'System Administrator', Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord,
};
const permissionSetsById = {
  [PERM_SET_ID]: { Label: 'Sales User', Name: 'Sales_User' } as PermissionSetNoProfileRecord,
};

const AUDIT_COLUMN_KEYS = ['createdDate', 'createdBy', 'lastModifiedDate', 'lastModifiedBy'];

describe('field permission audit columns', () => {
  it('should place the audit columns after the row action and before any permission column', () => {
    const columns = getFieldColumns([], [], {}, {});
    expect(columns.map(({ key }) => key)).toEqual(['sobject', 'tableLabel', '_ROW_ACTION', ...AUDIT_COLUMN_KEYS]);
  });

  it('should keep every audit column ahead of the profile and permission set columns', () => {
    const keys = getFieldColumns([PROFILE_ID], [PERM_SET_ID], profilesById, permissionSetsById).map(({ key }) => key);
    const lastAuditIndex = Math.max(...AUDIT_COLUMN_KEYS.map((key) => keys.indexOf(key)));
    const firstPermissionIndex = keys.findIndex((key) => key.startsWith(PROFILE_ID) || key.startsWith(PERM_SET_ID));

    expect(lastAuditIndex).toBeGreaterThan(-1);
    expect(lastAuditIndex).toBeLessThan(firstPermissionIndex);
  });

  it('should leave the frozen columns unchanged and contiguous', () => {
    const columns = getFieldColumns([PROFILE_ID], [], profilesById, {});
    const frozenIndexes = columns.map((column, index) => ({ column, index })).filter(({ column }) => column.frozen);

    expect(frozenIndexes.map(({ column }) => column.key)).toEqual(['tableLabel', '_ROW_ACTION']);
    expect(frozenIndexes.map(({ index }) => index)).toEqual([1, 2]);
  });

  it('should keep the object group cell spanning only the object, field and row action columns', () => {
    const [sobjectColumn] = getFieldColumns([PROFILE_ID], [], profilesById, {});
    expect(sobjectColumn.colSpan?.({ type: 'GROUP' } as any)).toBe(3);
    expect(sobjectColumn.colSpan?.({ type: 'ROW' } as any)).toBeUndefined();
  });

  it('should not make audit columns editable, which also keeps them out of paste targets', () => {
    const columns = getFieldColumns([PROFILE_ID], [], profilesById, {});
    AUDIT_COLUMN_KEYS.forEach((key) => {
      expect(columns.find((column) => column.key === key)?.editable).toBeUndefined();
    });
  });

  it('should omit the SET filter on date columns, where values are near unique per row', () => {
    const columns = getFieldColumns([], [], {}, {});
    expect(columns.find((column) => column.key === 'createdDate')?.filters).toEqual(['DATE']);
    expect(columns.find((column) => column.key === 'lastModifiedDate')?.filters).toEqual(['DATE']);
    // The user name columns have few distinct values, so the SET filter is useful there
    expect(columns.find((column) => column.key === 'createdBy')?.filters).toContain('SET');
  });

  it('should format the date value and leave standard fields (which have no audit data) blank', () => {
    const createdDate = getFieldColumns([], [], {}, {}).find((column) => column.key === 'createdDate');
    const withAudit = { createdDate: '2020-04-22T14:48:23.000+0000' } as PermissionTableFieldCell;
    const standardField = {} as PermissionTableFieldCell;

    // Formatted for display rather than passed through raw. Not asserted exactly - the formatter renders in
    // the local timezone, so the date and time parts vary by where the test runs.
    const formatted = createdDate?.getValue?.({ column: createdDate, row: withAudit } as any);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);

    expect(createdDate?.getValue?.({ column: createdDate, row: standardField } as any)).toBeNull();
  });
});

describe('visible audit column persistence', () => {
  it('should return nothing when there is no stored value', () => {
    expect(parseVisibleFieldAuditColumns(null)).toEqual(new Set());
    expect(parseVisibleFieldAuditColumns(undefined)).toEqual(new Set());
    expect(parseVisibleFieldAuditColumns('')).toEqual(new Set());
  });

  it('should discard unrecognized keys so a stale value degrades to hidden rather than breaking the table', () => {
    expect(parseVisibleFieldAuditColumns('bogus,createdDate,,someRemovedColumn')).toEqual(new Set(['createdDate']));
    expect(parseVisibleFieldAuditColumns('bogus')).toEqual(new Set());
  });

  it('should tolerate whitespace around a hand-edited value', () => {
    expect(parseVisibleFieldAuditColumns(' createdBy , lastModifiedBy ')).toEqual(new Set(['createdBy', 'lastModifiedBy']));
  });

  it('should serialize in column order regardless of the order columns were toggled on', () => {
    const toggledOutOfOrder = new Set<FieldAuditColumnKey>(['lastModifiedBy', 'createdDate']);
    expect(serializeVisibleFieldAuditColumns(toggledOutOfOrder)).toBe('createdDate,lastModifiedBy');
  });

  it('should serialize an empty set to the value written when the columns are all hidden', () => {
    expect(serializeVisibleFieldAuditColumns(new Set())).toBe('');
  });

  it('should round trip to a canonical order', () => {
    expect(serializeVisibleFieldAuditColumns(parseVisibleFieldAuditColumns('lastModifiedBy,createdDate'))).toBe(
      'createdDate,lastModifiedBy',
    );
    expect(serializeVisibleFieldAuditColumns(parseVisibleFieldAuditColumns(AUDIT_COLUMN_KEYS.join(',')))).toBe(AUDIT_COLUMN_KEYS.join(','));
  });
});

describe('getFieldAuditExportHeaders', () => {
  it('should name the timezone on the date headers, since the exported values carry no offset', () => {
    const [createdDate, createdBy, lastModifiedDate, lastModifiedBy] = getFieldAuditExportHeaders();
    // The IANA name, which is correct on both sides of a daylight saving change - unlike an abbreviation like CDT
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(createdDate).toBe(`Created Date (${timeZone})`);
    expect(lastModifiedDate).toBe(`Last Modified Date (${timeZone})`);
    // Only the date columns are timezone dependent
    expect(createdBy).toBe('Created By');
    expect(lastModifiedBy).toBe('Last Modified By');
  });
});
