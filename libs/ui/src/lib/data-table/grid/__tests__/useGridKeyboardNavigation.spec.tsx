import { useTable } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SELECT_COLUMN_KEY } from '../grid-constants';
import { jetstreamTableFeatures } from '../grid-features';
import { TanstackColumnDef, TanstackTable } from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { getSelectionBounds } from '../selection/grid-selection';

interface Row {
  _key: string;
  Name: string;
  Amount: string;
}

// Mirrors the real column order: the frozen select/action columns come FIRST and are never selectable.
const columns: TanstackColumnDef<Row>[] = [
  { id: SELECT_COLUMN_KEY, enableCellSelection: false },
  { id: 'Name', accessorKey: 'Name' },
  { id: 'Amount', accessorKey: 'Amount' },
];

const data: Row[] = [
  { _key: '1', Name: 'Alpha', Amount: '10' },
  { _key: '2', Name: 'Bravo', Amount: '20' },
  { _key: '3', Name: 'Charlie', Amount: '30' },
];

function renderNav(options: { columns?: TanstackColumnDef<Row>[]; scrollLeft?: number } = {}) {
  const scroller = document.createElement('div');
  scroller.scrollLeft = options.scrollLeft ?? 0;
  return renderHook(() => {
    const table = useTable({
      features: jetstreamTableFeatures,
      data,
      columns: options.columns ?? columns,
      getRowId: (row) => row._key,
    }) as unknown as TanstackTable<Row>;
    const keyboardNav = useGridKeyboardNavigation({ table, getRootElement: () => null, getScrollElement: () => scroller });
    return { table, keyboardNav };
  });
}

/** The permission-manager shape: a frozen DATA column pinned at the far left, ahead of scrollable ones. */
const frozenDataColumns: TanstackColumnDef<Row>[] = [
  { id: 'Name', accessorKey: 'Name', meta: { jetstream: { frozen: true } } as TanstackColumnDef<Row>['meta'] },
  { id: 'Amount', accessorKey: 'Amount' },
];

describe('useGridKeyboardNavigation — mouse range drag', () => {
  test('mouseenter without a mousedown does not extend anything', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Amount'));

    expect(result.current.keyboardNav.activeCell).toBeNull();
    expect(getSelectionBounds(result.current.table)).toHaveLength(0);
  });

  test('mousedown then mouseenter grows the rectangle from the mousedown cell', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Name', false));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Amount'));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '3', columnId: 'Amount' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 2, minColumnIndex: 1, maxColumnIndex: 2 }]);
  });

  test('dragging over a non-selectable column changes nothing at all', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Amount', false));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Name'));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', SELECT_COLUMN_KEY));

    // The select/action columns are frozen at the far left and can never join a range. The active cell
    // must not move there either: the active-column scroll-into-view effect would follow it and yank
    // the viewport back to column 0, and every cell the drag then passed over would join the range.
    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '3', columnId: 'Name' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 2, minColumnIndex: 1, maxColumnIndex: 2 }]);
  });

  test('dragging onto a frozen data column is ignored while it covers scrolled-away content', () => {
    const { result } = renderNav({ columns: frozenDataColumns, scrollLeft: 400 });
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Amount', false));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Name'));

    // Permission manager pins a wide `tableLabel` column. Scrolled right, it sits on top of the columns
    // the drag is reaching for, so a hit there means "keep going left", not "select the pinned column".
    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '1', columnId: 'Amount' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 1, maxColumnIndex: 1 }]);
  });

  test('a frozen data column is an ordinary drag target once the grid is scrolled home', () => {
    const { result } = renderNav({ columns: frozenDataColumns, scrollLeft: 0 });
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Amount', false));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Name'));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '3', columnId: 'Name' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 2, minColumnIndex: 0, maxColumnIndex: 1 }]);
  });

  test('a mouseenter back onto the current focus corner is a no-op, not a re-render', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Name', false));
    act(() => result.current.keyboardNav.handleCellMouseEnter('2', 'Amount'));
    const activeCell = result.current.keyboardNav.activeCell;

    act(() => result.current.keyboardNav.handleCellMouseEnter('2', 'Amount'));

    // Identity, not equality: auto-scroll re-fires mouseenter for scroll-induced hover changes, and a
    // fresh active-cell object would re-render the grid AND reset the interaction source away from
    // 'drag-autoscroll' (which is what keeps the virtualizers' scroll-into-view suppressed).
    expect(result.current.keyboardNav.activeCell).toBe(activeCell);
  });

  test('right-click never starts a drag', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Name', false, 2));
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Amount'));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '1', columnId: 'Name' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 1, maxColumnIndex: 1 }]);
  });

  test('releasing the mouse anywhere ends the drag', () => {
    const { result } = renderNav();
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Name', false));
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    act(() => result.current.keyboardNav.handleCellMouseEnter('3', 'Amount'));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: '1', columnId: 'Name' });
    expect(getSelectionBounds(result.current.table)).toEqual([{ minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 1, maxColumnIndex: 1 }]);
  });
});
