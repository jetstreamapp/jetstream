import { QueryResults, QueryResultsColumn } from '@jetstream/types';
import { parseQuery } from '@jetstreamapp/soql-parser-js';
import { describe, expect, test } from 'vitest';
import { getColumnDefinitions } from '../grid-column-utils';
import { NON_DATA_COLUMN_KEYS, SELECT_COLUMN_KEY } from '../grid-constants';

/** Keys of the field columns, ignoring the selection/action columns the grid prepends */
function dataColumnKeys(columns: { key: string }[]) {
  return columns.map(({ key }) => key).filter((key) => !NON_DATA_COLUMN_KEYS.has(key));
}

function makeColumn(columnFullPath: string, overrides: Partial<QueryResultsColumn> = {}): QueryResultsColumn {
  return {
    columnFullPath,
    columnName: columnFullPath.split('.').pop() || columnFullPath,
    displayName: columnFullPath,
    aggregate: false,
    apexType: 'String',
    booleanType: false,
    custom: false,
    foreignKeyName: null,
    insertable: true,
    numberType: false,
    textType: true,
    updatable: true,
    ...overrides,
  };
}

function makeResults(soql: string, columns?: QueryResultsColumn[]): QueryResults<any> {
  return {
    queryResults: { done: true, totalSize: 1, records: [{ Id: '001', attributes: { type: 'Account', url: '/x/001' } }] } as any,
    parsedQuery: parseQuery(soql),
    columns: columns ? ({ entityName: 'Account', groupBy: false, idSelected: true, keyPrefix: '001', columns } as any) : undefined,
  };
}

const NESTED_SOQL = `SELECT Id, (SELECT Id, Name, (SELECT Id, Subject FROM Cases) FROM Contacts) FROM Account`;

describe('getColumnDefinitions — nested subqueries', () => {
  test('builds column definitions for a nested subquery keyed by relationship path', () => {
    const results = makeResults(NESTED_SOQL, [
      makeColumn('Id', { apexType: 'Id' }),
      makeColumn('Contacts', {
        childColumnPaths: [
          makeColumn('Contacts.Id', { apexType: 'Id' }),
          makeColumn('Contacts.Name'),
          makeColumn('Contacts.Cases', {
            childColumnPaths: [makeColumn('Contacts.Cases.Id', { apexType: 'Id' }), makeColumn('Contacts.Cases.Subject')],
          }),
        ],
      }),
    ]);

    const { subqueryColumns } = getColumnDefinitions(results, false);

    expect(Object.keys(subqueryColumns).sort()).toEqual(['contacts', 'contacts.cases']);
    expect(dataColumnKeys(subqueryColumns['contacts.cases'])).toEqual(['Id', 'Subject']);
  });

  test('column keys within a subquery are relative to that subquery, matching the keys on its records', () => {
    const results = makeResults(NESTED_SOQL, [
      makeColumn('Id', { apexType: 'Id' }),
      makeColumn('Contacts', {
        childColumnPaths: [
          makeColumn('Contacts.Id', { apexType: 'Id' }),
          makeColumn('Contacts.Name'),
          makeColumn('Contacts.Cases', {
            childColumnPaths: [makeColumn('Contacts.Cases.Id', { apexType: 'Id' }), makeColumn('Contacts.Cases.Subject')],
          }),
        ],
      }),
    ]);

    const { subqueryColumns } = getColumnDefinitions(results, false);

    // The nested subquery column inside the Contacts grid is keyed `Cases`, which is how it appears on a Contact record
    expect(dataColumnKeys(subqueryColumns['contacts'])).toEqual(['Id', 'Name', 'Cases']);
  });

  test('types a nested subquery column as a subquery so it renders a drill-down instead of a blank cell', () => {
    const results = makeResults(NESTED_SOQL, [
      makeColumn('Id', { apexType: 'Id' }),
      makeColumn('Contacts', {
        childColumnPaths: [
          makeColumn('Contacts.Id', { apexType: 'Id' }),
          makeColumn('Contacts.Name'),
          makeColumn('Contacts.Cases', { childColumnPaths: [makeColumn('Contacts.Cases.Id', { apexType: 'Id' })] }),
        ],
      }),
    ]);

    const { subqueryColumns } = getColumnDefinitions(results, false);
    const casesColumn = subqueryColumns['contacts'].find((column) => column.key === 'Cases');

    // A subquery column resolves its display value from the QueryResult rather than the raw object
    expect(casesColumn?.getValue?.({ column: casesColumn, row: { Cases: { totalSize: 2, records: [{}, {}] } } } as any)).toBe('2 records');
    expect(casesColumn?.getValue?.({ column: casesColumn, row: { Cases: null } } as any)).toBeNull();
  });

  test('still types a nested subquery when Salesforce reports no child columns for it', () => {
    // Salesforce omits childColumnPaths for a subquery that matched no rows
    const results = makeResults(NESTED_SOQL, [
      makeColumn('Id', { apexType: 'Id' }),
      makeColumn('Contacts', {
        childColumnPaths: [makeColumn('Contacts.Id', { apexType: 'Id' }), makeColumn('Contacts.Name'), makeColumn('Contacts.Cases')],
      }),
    ]);

    const { subqueryColumns } = getColumnDefinitions(results, false);
    const casesColumn = subqueryColumns['contacts'].find((column) => column.key === 'Cases');

    expect(casesColumn?.getValue?.({ column: casesColumn, row: { Cases: { totalSize: 1, records: [{}] } } } as any)).toBe('1 record');
  });

  test('resolves same-named subqueries at different depths independently', () => {
    const results = makeResults(
      `SELECT Id, (SELECT Id FROM Cases), (SELECT Id, (SELECT Id, Subject FROM Cases) FROM Contacts) FROM Account`,
      [
        makeColumn('Id', { apexType: 'Id' }),
        makeColumn('Cases', { childColumnPaths: [makeColumn('Cases.Id', { apexType: 'Id' })] }),
        makeColumn('Contacts', {
          childColumnPaths: [
            makeColumn('Contacts.Id', { apexType: 'Id' }),
            makeColumn('Contacts.Cases', {
              childColumnPaths: [makeColumn('Contacts.Cases.Id', { apexType: 'Id' }), makeColumn('Contacts.Cases.Subject')],
            }),
          ],
        }),
      ],
    );

    const { subqueryColumns } = getColumnDefinitions(results, false);

    expect(dataColumnKeys(subqueryColumns['cases'])).toEqual(['Id']);
    expect(dataColumnKeys(subqueryColumns['contacts.cases'])).toEqual(['Id', 'Subject']);
  });

  test('builds nested subquery columns even without Salesforce column metadata', () => {
    const { subqueryColumns } = getColumnDefinitions(makeResults(NESTED_SOQL), false);

    expect(Object.keys(subqueryColumns).sort()).toEqual(['contacts', 'contacts.cases']);
    expect(dataColumnKeys(subqueryColumns['contacts.cases'])).toEqual(['Id', 'Subject']);
    // Without column metadata the nested relationship is still typed as a subquery from the parsed query
    const casesColumn = subqueryColumns['contacts'].find((column) => column.key === 'Cases');
    expect(casesColumn?.getValue?.({ column: casesColumn, row: { Cases: { totalSize: 1, records: [{}] } } } as any)).toBe('1 record');
  });

  test('prepends the row selection column at every subquery depth', () => {
    const { subqueryColumns } = getColumnDefinitions(makeResults(NESTED_SOQL), false);

    // The subquery modal draws its checkboxes from this column, so nested grids need it too
    expect(subqueryColumns['contacts'][0].key).toBe(SELECT_COLUMN_KEY);
    expect(subqueryColumns['contacts.cases'][0].key).toBe(SELECT_COLUMN_KEY);
  });

  test('top level subquery columns are unaffected', () => {
    const results = makeResults(`SELECT Id, Name, (SELECT Id, Email FROM Contacts) FROM Account`, [
      makeColumn('Id', { apexType: 'Id' }),
      makeColumn('Name'),
      makeColumn('Contacts', {
        childColumnPaths: [makeColumn('Contacts.Id', { apexType: 'Id' }), makeColumn('Contacts.Email')],
      }),
    ]);

    const { parentColumns, subqueryColumns } = getColumnDefinitions(results, false);

    expect(dataColumnKeys(subqueryColumns['contacts'])).toEqual(['Id', 'Email']);
    expect(parentColumns.map((column) => column.key)).toEqual(expect.arrayContaining(['Id', 'Name', 'Contacts']));
  });
});
