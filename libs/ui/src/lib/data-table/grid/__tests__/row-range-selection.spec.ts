import { GroupingState, RowSelectionState, useTable } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { jetstreamTableFeatures } from '../grid-features';
import { TanstackColumnDef, TanstackRow, TanstackTable } from '../grid-types';

/**
 * Pins down the v9 built-in Shift-range row selection the grid adopted (replacing the hand-rolled
 * `selectRowRange`). Both select-checkbox paths (GridCell's bare input and SelectFormatter) route
 * through `row.getToggleSelectedHandler()`, which tracks the anchor internally and applies the
 * display-order range when the event carries Shift.
 */

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

const columns: TanstackColumnDef<TestRow>[] = [
  { id: 'Name', accessorKey: 'Name' },
  { id: 'Dept', accessorKey: 'Dept' },
];

function makeTable(options: { enableRowSelection?: boolean | ((row: TanstackRow<TestRow>) => boolean); grouping?: GroupingState } = {}) {
  const { enableRowSelection = true, grouping } = options;
  const { result } = renderHook(() => {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    return useTable({
      features: jetstreamTableFeatures,
      data,
      columns,
      state: { rowSelection, grouping: grouping ?? [], expanded: grouping ? (true as const) : {} },
      getRowId: (row) => row._key,
      enableRowSelection,
      onRowSelectionChange: setRowSelection,
    });
  });
  return result;
}

/** Simulate a checkbox interaction the way GridCell/SelectFormatter hand it to TanStack. */
function clickCheckbox(table: TanstackTable<TestRow>, rowId: string, checked: boolean, shiftKey = false) {
  act(() => {
    table.getRow(rowId, true).getToggleSelectedHandler()({ target: { checked }, shiftKey });
  });
}

function selectedKeys(table: TanstackTable<TestRow>) {
  const rowSelection = table.store.state.rowSelection;
  return Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .sort();
}

describe('v9 shift-range row selection (getToggleSelectedHandler)', () => {
  test('plain clicks toggle single rows and establish the anchor', () => {
    const result = makeTable();
    clickCheckbox(result.current, '2', true);
    expect(selectedKeys(result.current)).toEqual(['2']);
    clickCheckbox(result.current, '4', true);
    expect(selectedKeys(result.current)).toEqual(['2', '4']);
  });

  test('fills a forward range (anchor above target) on shift-click', () => {
    const result = makeTable();
    clickCheckbox(result.current, '2', true);
    clickCheckbox(result.current, '4', true, true);
    expect(selectedKeys(result.current)).toEqual(['2', '3', '4']);
  });

  test('fills a backward range (target above anchor) inclusively', () => {
    const result = makeTable();
    clickCheckbox(result.current, '4', true);
    clickCheckbox(result.current, '2', true, true);
    expect(selectedKeys(result.current)).toEqual(['2', '3', '4']);
  });

  test('shift-unchecking deselects the range', () => {
    const result = makeTable();
    clickCheckbox(result.current, '2', true);
    clickCheckbox(result.current, '3', true);
    clickCheckbox(result.current, '4', true);
    // Anchor is now 4; uncheck 2 (anchor moves to 2), then shift-uncheck 4 → range 2-4 cleared.
    clickCheckbox(result.current, '2', false);
    clickCheckbox(result.current, '4', false, true);
    expect(selectedKeys(result.current)).toEqual([]);
  });

  test('skips non-selectable rows in the range', () => {
    const result = makeTable({ enableRowSelection: (row) => row.id !== '3' });
    clickCheckbox(result.current, '2', true);
    clickCheckbox(result.current, '4', true, true);
    expect(result.current.getRow('3', true).getIsSelected()).toBe(false);
    expect(selectedKeys(result.current)).toEqual(['2', '4']);
  });

  test('a range spanning a group header selects the whole group (v9 semantics)', () => {
    const result = makeTable({ grouping: ['Dept'] });
    // Display order with groups expanded: [group X, 1, 2, group Y, 3, 4, 5]. A shift-range from leaf 2
    // to leaf 3 sweeps the "Y" group header row; unlike the retired hand-rolled behavior (which
    // skipped group rows), v9 selects the swept group row AND all of its children.
    clickCheckbox(result.current, '2', true);
    clickCheckbox(result.current, '3', true, true);
    expect(selectedKeys(result.current)).toEqual(['2', '3', '4', '5', 'Dept:Y']);
  });

  test('shift-click without an anchor falls back to a plain toggle', () => {
    const result = makeTable();
    clickCheckbox(result.current, '4', true, true);
    expect(selectedKeys(result.current)).toEqual(['4']);
  });
});
