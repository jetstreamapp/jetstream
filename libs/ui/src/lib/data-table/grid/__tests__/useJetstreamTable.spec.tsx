import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, test } from 'vitest';
import { useJetstreamTable } from '../core/useJetstreamTable';
import { EMPTY_FIELD } from '../grid-constants';
import { ColumnWithFilter, DataTableRef } from '../grid-types';

interface Row {
  _key: string;
  Id: string;
  Name: string;
  Notes: string;
}

const columns: ColumnWithFilter<Row>[] = [
  { key: 'Id', name: 'Id', sortable: true, filters: ['TEXT', 'SET'] },
  { key: 'Name', name: 'Name', sortable: true, filters: ['TEXT', 'SET'] },
  { key: 'Notes', name: 'Notes', sortable: true, filters: ['TEXT'] },
];

const data: Row[] = [
  { _key: '1', Id: '001', Name: 'Charlie', Notes: 'hello world' },
  { _key: '2', Id: '002', Name: 'Alpha', Notes: 'foo bar' },
  { _key: '3', Id: '003', Name: 'Bravo', Notes: 'baz qux' },
];

function setup(overrides: Partial<Parameters<typeof useJetstreamTable<Row>>[0]> = {}) {
  const ref = createRef<DataTableRef<Row>>();
  const result = renderHook(() =>
    useJetstreamTable<Row>({
      data,
      columns,
      getRowKey: (row) => row._key,
      includeQuickFilter: true,
      ref,
      ...overrides,
    }),
  );
  // flush the INIT effect that seeds filters + distinct set values
  act(() => undefined);
  return { ...result, ref };
}

/** Like `setup`, but the data is a prop so tests can `rerender({ rows })` to simulate data changes. */
function setupWithRows(initialRows: Row[]) {
  const ref = createRef<DataTableRef<Row>>();
  const result = renderHook(
    ({ rows }: { rows: Row[] }) => useJetstreamTable<Row>({ data: rows, columns, getRowKey: (row) => row._key, ref }),
    { initialProps: { rows: initialRows } },
  );
  act(() => undefined);
  return result;
}

function rowKeys(rows: readonly Row[]) {
  return rows.map((row) => row._key);
}

function visibleRowKeys(table: ReturnType<typeof useJetstreamTable<Row>>['table']) {
  return rowKeys(table.getRowModel().rows.map((row) => row.original)).sort();
}

describe('useJetstreamTable', () => {
  test('renders all rows when no filter/sort applied', () => {
    const { result } = setup();
    expect(result.current.table.getRowModel().rows).toHaveLength(3);
  });

  test('coerces row ids to strings even when getRowKey returns a non-string', () => {
    // A numeric row id would break string ops (e.g. rowId.startsWith() inside isSummaryRowId) during keyboard nav.
    const { result } = setup({ getRowKey: (row) => Number(row._key) as unknown as string });
    result.current.table.getRowModel().rows.forEach((row) => expect(typeof row.id).toBe('string'));
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual(['1', '2', '3']);
  });

  test('quick filter narrows rows case-insensitively', () => {
    const { result } = setup({ quickFilterText: 'ALPHA' });
    const rows = result.current.table.getRowModel().rows.map((row) => row.original);
    expect(rowKeys(rows)).toEqual(['2']);
  });

  test('sorting by Name ascending reorders rows', () => {
    const { result } = setup({ initialSortColumns: [{ columnKey: 'Name', direction: 'ASC' }] });
    const rows = result.current.table.getRowModel().rows.map((row) => row.original);
    expect(rows.map((row) => row.Name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('SET filter narrows to selected values', () => {
    const { result } = setup();
    act(() => {
      result.current.updateFilter('Name', { type: 'SET', value: ['Alpha'] });
    });
    const rows = result.current.table.getRowModel().rows.map((row) => row.original);
    expect(rowKeys(rows)).toEqual(['2']);
  });

  test('SET filter keeps narrowing when the data drops a value the filter had selected', () => {
    // e.g. deploy metadata "Hide Empty Types" removes the blank-Name rows the user left selected
    const blankRow: Row = { _key: '4', Id: '004', Name: null as unknown as string, Notes: '' };
    const { result, rerender } = setupWithRows([...data, blankRow]);
    act(() => {
      result.current.updateFilter('Name', { type: 'SET', value: [EMPTY_FIELD, 'Alpha', 'Bravo'] });
    });
    expect(visibleRowKeys(result.current.table)).toEqual(['2', '3', '4']);

    rerender({ rows: data });
    expect(visibleRowKeys(result.current.table)).toEqual(['2', '3']);

    // the blank value is still selected once it comes back
    rerender({ rows: [...data, blankRow] });
    expect(visibleRowKeys(result.current.table)).toEqual(['2', '3', '4']);
  });

  test.each([
    ['shrinks', [data[1]]],
    ['drops only the deselected value', [data[1], data[2]]],
    ['is emptied', []],
  ])('SET filter keeps a deselected value deselected after the data %s and is restored', (_label, interimRows) => {
    const { result, rerender } = setupWithRows(data);
    act(() => {
      result.current.updateFilter('Name', { type: 'SET', value: ['Alpha', 'Bravo'] });
    });
    expect(visibleRowKeys(result.current.table)).toEqual(['2', '3']);

    rerender({ rows: interimRows });
    rerender({ rows: data });
    expect(visibleRowKeys(result.current.table)).toEqual(['2', '3']);
  });

  test('rowAlwaysVisible bypasses active filters', () => {
    const { result } = setup({ rowAlwaysVisible: (row) => row._key === '3' });
    act(() => {
      result.current.updateFilter('Name', { type: 'SET', value: ['Alpha'] });
    });
    const rows = result.current.table.getRowModel().rows.map((row) => row.original);
    expect(rowKeys(rows).sort()).toEqual(['2', '3']);
  });

  test('ref exposes filtered + sorted rows and sort state', () => {
    const { ref } = setup({ initialSortColumns: [{ columnKey: 'Name', direction: 'DESC' }] });
    expect(ref.current?.hasSortApplied()).toBe(true);
    const refRows = ref.current?.getFilteredAndSortedRows() ?? [];
    expect(refRows.map((row) => row.Name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(ref.current?.getCurrentColumnNames()).toEqual(['Id', 'Name', 'Notes']);
  });
});
