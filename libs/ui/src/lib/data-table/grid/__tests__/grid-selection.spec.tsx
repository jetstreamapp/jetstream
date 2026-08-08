import { CellSelectionBounds, useTable } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { jetstreamTableFeatures } from '../grid-features';
import { TanstackColumnDef, TanstackTable } from '../grid-types';
import {
  addOrExcludeCellRange,
  clearCellSelection,
  collapseSelectionTo,
  extendActiveSelectionTo,
  getActiveRangeRect,
  getCellRangeEdges,
  getRowSelectionSpans,
  getSelectionBounds,
  hasMultiCellSelection,
  isCellInSelectionBounds,
} from '../selection/grid-selection';

interface Row {
  _key: string;
  Name: string;
  Amount: string;
}

const columns: TanstackColumnDef<Row>[] = [
  { id: 'Name', accessorKey: 'Name' },
  { id: 'Amount', accessorKey: 'Amount' },
];

const data: Row[] = [
  { _key: '1', Name: 'Alpha', Amount: '10' },
  { _key: '2', Name: 'Bravo', Amount: '20' },
  { _key: '3', Name: 'Charlie', Amount: '30' },
  { _key: '4', Name: 'Delta', Amount: '40' },
];

function makeTable() {
  const { result } = renderHook(() =>
    useTable({
      features: jetstreamTableFeatures,
      data,
      columns,
      getRowId: (row) => row._key,
    }),
  );
  return result;
}

describe('grid-selection facade (v9 cellSelectionFeature)', () => {
  test('collapse → single-cell bounds aligned with the rendered row model indexes', () => {
    const result = makeTable();
    act(() => collapseSelectionTo(result.current as TanstackTable<Row>, '2', 'Name'));

    const bounds = getSelectionBounds(result.current as TanstackTable<Row>);
    expect(bounds).toHaveLength(1);
    // Row '2' renders at display index 1 in getRowModel() — the bounds index space MUST match the
    // index space GridBody renders from, or every span/edge computation is off by rows.
    expect(result.current.getRowModel().rows[bounds[0].minRowIndex].id).toBe('2');
    expect(bounds[0]).toEqual({ minRowIndex: 1, maxRowIndex: 1, minColumnIndex: 0, maxColumnIndex: 0 });
    expect(hasMultiCellSelection(bounds)).toBe(false);
  });

  test('extend grows the active range from its fixed anchor', () => {
    const result = makeTable();
    act(() => collapseSelectionTo(result.current as TanstackTable<Row>, '2', 'Name'));
    act(() => extendActiveSelectionTo(result.current as TanstackTable<Row>, '4', 'Amount'));

    const bounds = getSelectionBounds(result.current as TanstackTable<Row>);
    expect(bounds).toEqual([{ minRowIndex: 1, maxRowIndex: 3, minColumnIndex: 0, maxColumnIndex: 1 }]);
    expect(hasMultiCellSelection(bounds)).toBe(true);
    // Extending again REPLACES the focus corner (anchor stays at row '2').
    act(() => extendActiveSelectionTo(result.current as TanstackTable<Row>, '3', 'Name'));
    expect(getSelectionBounds(result.current as TanstackTable<Row>)).toEqual([
      { minRowIndex: 1, maxRowIndex: 2, minColumnIndex: 0, maxColumnIndex: 0 },
    ]);
  });

  test('ctrl-style add/exclude produces disjoint ranges and punches holes', () => {
    const result = makeTable();
    act(() => collapseSelectionTo(result.current as TanstackTable<Row>, '1', 'Name'));
    act(() => extendActiveSelectionTo(result.current as TanstackTable<Row>, '3', 'Amount'));
    // Add a disjoint cell (unselected → include).
    act(() => addOrExcludeCellRange(result.current as TanstackTable<Row>, '4', 'Name'));
    expect(isCellInSelectionBounds(result.current as TanstackTable<Row>, '4', 'Name')).toBe(true);
    expect(getSelectionBounds(result.current as TanstackTable<Row>).length).toBeGreaterThan(1);
    // Exclude a selected cell (punches a hole in the first rectangle).
    act(() => addOrExcludeCellRange(result.current as TanstackTable<Row>, '2', 'Name'));
    expect(isCellInSelectionBounds(result.current as TanstackTable<Row>, '2', 'Name')).toBe(false);
    expect(isCellInSelectionBounds(result.current as TanstackTable<Row>, '2', 'Amount')).toBe(true);
  });

  test('active-range rect targets the LAST range only (paste semantics) and clear empties everything', () => {
    const result = makeTable();
    act(() => collapseSelectionTo(result.current as TanstackTable<Row>, '1', 'Name'));
    act(() => extendActiveSelectionTo(result.current as TanstackTable<Row>, '2', 'Amount'));
    act(() => addOrExcludeCellRange(result.current as TanstackTable<Row>, '4', 'Amount'));

    // The ctrl-added single cell is now the active range.
    expect(getActiveRangeRect(result.current as TanstackTable<Row>)).toEqual({ minRow: 3, maxRow: 3, minCol: 1, maxCol: 1 });

    act(() => clearCellSelection(result.current as TanstackTable<Row>));
    expect(getSelectionBounds(result.current as TanstackTable<Row>)).toEqual([]);
    expect(getActiveRangeRect(result.current as TanstackTable<Row>)).toBeNull();
  });

  test('selection survives a sort (ranges are id-anchored)', () => {
    const result = makeTable();
    act(() => collapseSelectionTo(result.current as TanstackTable<Row>, '2', 'Name'));
    act(() => result.current.setSorting([{ id: 'Name', desc: true }]));

    const bounds = getSelectionBounds(result.current as TanstackTable<Row>);
    expect(bounds).toHaveLength(1);
    // Row '2' (Bravo) now renders at a different display index; the bounds follow it.
    expect(result.current.getRowModel().rows[bounds[0].minRowIndex].id).toBe('2');
  });
});

describe('span/edge math (pure helpers)', () => {
  const bounds: CellSelectionBounds[] = [
    { minRowIndex: 1, maxRowIndex: 3, minColumnIndex: 0, maxColumnIndex: 2 },
    { minRowIndex: 2, maxRowIndex: 2, minColumnIndex: 4, maxColumnIndex: 5 },
  ];

  test('spans per row: rectangles intersecting the row, sorted by start column', () => {
    expect(getRowSelectionSpans(bounds, 0)).toBeNull();
    expect(getRowSelectionSpans(bounds, 1)).toEqual([{ startCol: 0, endCol: 2, top: true, bottom: false }]);
    expect(getRowSelectionSpans(bounds, 2)).toEqual([
      { startCol: 0, endCol: 2, top: false, bottom: false },
      { startCol: 4, endCol: 5, top: true, bottom: true },
    ]);
  });

  test('span results are identity-cached per bounds array', () => {
    expect(getRowSelectionSpans(bounds, 2)).toBe(getRowSelectionSpans(bounds, 2));
    expect(getRowSelectionSpans(bounds, 0)).toBeNull();
  });

  test('edge bitmask: fill + rectangle boundary sides', () => {
    const middleRowSpans = getRowSelectionSpans(bounds, 2);
    // Column 0: selected + left edge (8) + fill (16); rows above/below are in-rect so no top/bottom.
    expect(getCellRangeEdges(middleRowSpans, 0)).toBe(16 | 8);
    // Column 2: selected + right edge.
    expect(getCellRangeEdges(middleRowSpans, 2)).toBe(16 | 2);
    // Column 3: the gap between rectangles — unselected.
    expect(getCellRangeEdges(middleRowSpans, 3)).toBe(0);
    // Column 4: single-row rectangle → top+bottom+left edges.
    expect(getCellRangeEdges(middleRowSpans, 4)).toBe(16 | 1 | 4 | 8);
    // Top row of the tall rectangle gets the top edge.
    expect(getCellRangeEdges(getRowSelectionSpans(bounds, 1), 1)).toBe(16 | 1);
  });
});
