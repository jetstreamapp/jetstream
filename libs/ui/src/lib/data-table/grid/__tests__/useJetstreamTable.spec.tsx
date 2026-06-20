import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, test } from 'vitest';
import { useJetstreamTable } from '../core/useJetstreamTable';
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

function rowKeys(rows: readonly Row[]) {
  return rows.map((row) => row._key);
}

describe('useJetstreamTable', () => {
  test('renders all rows when no filter/sort applied', () => {
    const { result } = setup();
    expect(result.current.table.getRowModel().rows).toHaveLength(3);
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
