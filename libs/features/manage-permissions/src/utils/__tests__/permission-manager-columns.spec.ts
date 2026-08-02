import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { getFieldColumns, getObjectColumns, getSystemPermissionColumns, getTabVisibilityColumns } from '../permission-manager-table-utils';

const PROFILE_ID = '0PS1t000000Profile';
const PERM_SET_ID = '0PS1t000000PermSet';

const profilesById = {
  [PROFILE_ID]: { Label: 'System Administrator', Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord,
};
const permissionSetsById = {
  [PERM_SET_ID]: { Label: 'Sales User', Name: 'Sales_User' } as PermissionSetNoProfileRecord,
};

const COLUMN_BUILDERS = [
  ['object', getObjectColumns, 7],
  ['field', getFieldColumns, 2],
  ['tabVisibility', getTabVisibilityColumns, 2],
  ['systemPermission', getSystemPermissionColumns, 1],
] as const;

describe('profile / permission set columns', () => {
  describe.each(COLUMN_BUILDERS)('%s table', (_type, getColumns, permissionsPerGroup) => {
    const columns = getColumns([PROFILE_ID], [PERM_SET_ID], profilesById, permissionSetsById);
    const groupColumns = columns.filter((column) => column.key.startsWith(PROFILE_ID) || column.key.startsWith(PERM_SET_ID));

    test('builds one column per permission for each profile and permission set', () => {
      expect(groupColumns).toHaveLength(permissionsPerGroup * 2);
    });

    test('only the group-header column renders a header cell — the rest are covered by its colSpan', () => {
      const withHeaderCell = groupColumns.filter((column) => !!column.renderHeaderCell);
      expect(withHeaderCell).toHaveLength(2);
      expect(withHeaderCell.map(({ key }) => key)).toEqual([groupColumns[0].key, groupColumns[permissionsPerGroup].key]);
    });

    test('the group-header column is not sortable so its label is not wrapped in a sort button', () => {
      groupColumns.forEach((column) => {
        expect(column.sortable).toBe(column.renderHeaderCell ? false : undefined);
      });
    });

    test('every permission column keeps its boolean filter', () => {
      groupColumns.forEach((column) => {
        expect(column.filters).toEqual(['BOOLEAN_SET']);
      });
    });

    test('column name stays a plain string for the csv / xlsx export paths', () => {
      expect(groupColumns[0].name).toBe('System Administrator (Profile)');
      expect(groupColumns[permissionsPerGroup].name).toBe('Sales_User (Permission Set)');
    });
  });
});
