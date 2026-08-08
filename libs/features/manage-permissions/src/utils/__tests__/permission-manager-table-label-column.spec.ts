import { PermissionTableObjectCell, PermissionTableTabVisibilityCell } from '@jetstream/types';
import { ColumnWithFilter, computeFilterSetValues } from '@jetstream/ui';
import { describe, expect, it } from 'vitest';
import { getObjectColumns, getTabVisibilityColumns } from '../permission-manager-table-utils';

/**
 * Regression coverage for the `tableLabel` column resolving to the literal string `undefined (undefined)`.
 *
 * `tableLabel` is already formatted as `Label (ApiName)`, but the object and tab tables defined a
 * `getValue` that treated `row.tableLabel` as an object and read `.label` / `.apiName` off the string.
 * The `as any` spread hid it, and the bad value reached the SET filter list, the quick-filter search
 * index and copy-to-clipboard.
 */

function buildObjectRow(label: string, apiName: string): PermissionTableObjectCell {
  return {
    key: apiName,
    sobject: apiName,
    apiName,
    label,
    tableLabel: `${label} (${apiName})`,
    allowEditPermission: true,
    allowViewAllModifyAllPermission: true,
    permissions: {},
  };
}

function buildTabRow(label: string, apiName: string): PermissionTableTabVisibilityCell {
  return {
    key: apiName,
    sobject: apiName,
    apiName,
    label,
    tableLabel: `${label} (${apiName})`,
    canSetPermission: true,
    permissions: {},
  };
}

function getTableLabelSetValues<TRow extends object>(columns: ColumnWithFilter<TRow, any>[], rows: TRow[]) {
  return computeFilterSetValues(columns as ColumnWithFilter<TRow>[], rows)['tableLabel'];
}

describe('tableLabel column filter values', () => {
  it('uses the formatted row label for the object table', () => {
    const columns = getObjectColumns([], [], {}, {});
    const rows = [buildObjectRow('Account', 'Account'), buildObjectRow('Albright Power', 'AlbrightPower__c')];

    expect(getTableLabelSetValues(columns, rows)).toEqual(['Account (Account)', 'Albright Power (AlbrightPower__c)']);
  });

  it('uses the formatted row label for the tab visibility table', () => {
    const columns = getTabVisibilityColumns([], [], {}, {});
    const rows = [buildTabRow('Account', 'Account'), buildTabRow('Albright Power', 'AlbrightPower__c')];

    expect(getTableLabelSetValues(columns, rows)).toEqual(['Account (Account)', 'Albright Power (AlbrightPower__c)']);
  });

  it.each([
    ['object', () => getObjectColumns([], [], {}, {})],
    ['tab visibility', () => getTabVisibilityColumns([], [], {}, {})],
  ])('does not override getValue on the %s tableLabel column', (_label, getColumns) => {
    // A `getValue` here would have to re-derive a value the row already holds - the source of the bug
    const tableLabelColumn = getColumns().find(({ key }) => key === 'tableLabel');

    expect(tableLabelColumn).toBeDefined();
    expect(tableLabelColumn?.getValue).toBeUndefined();
  });
});
