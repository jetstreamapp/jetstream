import {
  ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  GroupingState,
  Row,
  RowSelectionState,
  Table,
  useReactTable,
} from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { selectRowRange } from '../grid-row-utils';

interface TestRow {
  _key: string;
  Name: string;
  Dept: string;
}

const data: TestRow[] = [
  { _key: '1', Name: 'A', Dept: 'X' },
  { _key: '2', Name: 'B', Dept: 'X' },
  { _key: '3', Name: 'C', Dept: 'Y' },
  { _key: '4', Name: 'D', Dept: 'Y' },
  { _key: '5', Name: 'E', Dept: 'Y' },
];

const columns: ColumnDef<TestRow>[] = [
  { id: 'Name', accessorKey: 'Name' },
  { id: 'Dept', accessorKey: 'Dept' },
];

function makeTable(options: { enableRowSelection?: boolean | ((row: Row<TestRow>) => boolean); grouping?: GroupingState } = {}) {
  const { enableRowSelection = true, grouping } = options;
  const { result } = renderHook(() => {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    return useReactTable<TestRow>({
      data,
      columns,
      state: { rowSelection, grouping: grouping ?? [], expanded: grouping ? true : {} },
      getRowId: (row) => row._key,
      enableRowSelection,
      onRowSelectionChange: setRowSelection,
      getCoreRowModel: getCoreRowModel(),
      ...(grouping ? { getGroupedRowModel: getGroupedRowModel(), getExpandedRowModel: getExpandedRowModel() } : {}),
    });
  });
  return result;
}

/** Toggle a single row's selection (sets the anchor's starting state for a range test). */
function toggle(table: Table<TestRow>, rowId: string, selected: boolean) {
  act(() => table.getRow(rowId, true).toggleSelected(selected));
}

function selectedKeys(table: Table<TestRow>) {
  return Object.keys(table.getState().rowSelection)
    .filter((key) => table.getState().rowSelection[key])
    .sort();
}

describe('selectRowRange', () => {
  test('fills a forward range (anchor above target) with the anchor selected value', () => {
    const result = makeTable();
    toggle(result.current, '2', true);

    let applied = false;
    act(() => {
      applied = selectRowRange(result.current, '2', '4');
    });

    expect(applied).toBe(true);
    expect(selectedKeys(result.current)).toEqual(['2', '3', '4']);
  });

  test('fills a backward range (target above anchor) inclusively', () => {
    const result = makeTable();
    toggle(result.current, '4', true);

    act(() => {
      selectRowRange(result.current, '4', '2');
    });

    expect(selectedKeys(result.current)).toEqual(['2', '3', '4']);
  });

  test('clears the range when the anchor is unselected', () => {
    const result = makeTable();
    // Pre-select 2,3,4 then unselect the anchor (2) so its value is "unchecked".
    toggle(result.current, '2', true);
    toggle(result.current, '3', true);
    toggle(result.current, '4', true);
    toggle(result.current, '2', false);

    act(() => {
      selectRowRange(result.current, '2', '4');
    });

    expect(selectedKeys(result.current)).toEqual([]);
  });

  test('skips non-selectable rows in the range', () => {
    const result = makeTable({ enableRowSelection: (row) => row.id !== '3' });
    toggle(result.current, '2', true);

    act(() => {
      selectRowRange(result.current, '2', '4');
    });

    expect(result.current.getRow('3', true).getIsSelected()).toBe(false);
    expect(selectedKeys(result.current)).toEqual(['2', '4']);
  });

  test('skips group header rows in the range', () => {
    const result = makeTable({ grouping: ['Dept'] });
    // Rendered order with groups expanded: [group X, 1, 2, group Y, 3, 4, 5]. A range from leaf 2 to
    // leaf 3 spans the "Y" group header, which must not be added to the selection.
    toggle(result.current, '2', true);

    act(() => {
      selectRowRange(result.current, '2', '3');
    });

    expect(selectedKeys(result.current)).toEqual(['2', '3']);
    // No group-row id (e.g. "Dept:Y") leaked into the selection.
    expect(selectedKeys(result.current).every((key) => !key.includes(':'))).toBe(true);
  });

  test('returns false and leaves selection untouched when the anchor is not in the row model', () => {
    const result = makeTable();
    toggle(result.current, '2', true);

    let applied = true;
    act(() => {
      applied = selectRowRange(result.current, 'missing-anchor', '4');
    });

    expect(applied).toBe(false);
    expect(selectedKeys(result.current)).toEqual(['2']);
  });

  test('returns false when the target is not in the row model', () => {
    const result = makeTable();
    toggle(result.current, '2', true);

    let applied = true;
    act(() => {
      applied = selectRowRange(result.current, '2', 'missing-target');
    });

    expect(applied).toBe(false);
    expect(selectedKeys(result.current)).toEqual(['2']);
  });
});
