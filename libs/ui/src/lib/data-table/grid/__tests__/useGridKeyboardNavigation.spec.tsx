import { useTable } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HEADER_ROW_ID, SELECT_COLUMN_KEY } from '../grid-constants';
import { jetstreamTableFeatures } from '../grid-features';
import { TanstackColumnDef, TanstackTable } from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { getSelectionBounds } from '../selection/grid-selection';

const copyRecordsToClipboard = vi.hoisted(() => vi.fn());
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  copyRecordsToClipboard,
}));

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

function renderNav(options: { columns?: TanstackColumnDef<Row>[]; scrollLeft?: number; data?: Row[]; rootElement?: HTMLElement } = {}) {
  const scroller = document.createElement('div');
  scroller.scrollLeft = options.scrollLeft ?? 0;
  return renderHook(() => {
    const table = useTable({
      features: jetstreamTableFeatures,
      data: options.data ?? data,
      columns: options.columns ?? columns,
      getRowId: (row) => row._key,
    }) as unknown as TanstackTable<Row>;
    const keyboardNav = useGridKeyboardNavigation({
      table,
      getRootElement: () => options.rootElement ?? null,
      getScrollElement: () => scroller,
    });
    return { table, keyboardNav };
  });
}

function keyEvent(key: string): ReactKeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: null,
  } as unknown as ReactKeyboardEvent;
}

/** Flush the hook's rAF-deferred focus work inside act. */
async function flushFrame() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
  });
}

/** The permission-manager shape: a frozen DATA column pinned at the far left, ahead of scrollable ones. */
const frozenDataColumns: TanstackColumnDef<Row>[] = [
  { id: 'Name', accessorKey: 'Name', meta: { jetstream: { frozen: true } } as TanstackColumnDef<Row>['meta'] },
  { id: 'Amount', accessorKey: 'Amount' },
];

describe('useGridKeyboardNavigation — copying a range', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  /** Deploy's metadata table: a "No metadata found" child row renders a message through a row-level
   * colSpan and has no cell values. Row '2' is an ordinary row that happens to be blank. */
  const spannerColumns: TanstackColumnDef<Row>[] = [
    {
      id: 'Name',
      accessorKey: 'Name',
      meta: {
        jetstream: { colSpan: ({ type, row }) => (type === 'ROW' && (row as Row)?.Name === '' ? 2 : 1) },
      } as TanstackColumnDef<Row>['meta'],
    },
    { id: 'Amount', accessorKey: 'Amount' },
  ];
  const spannerData: Row[] = [
    { _key: '1', Name: 'Alpha', Amount: '10' },
    { _key: '2', Name: '', Amount: '' },
    { _key: '3', Name: '', Amount: '' },
    { _key: '4', Name: 'Delta', Amount: '40' },
  ];

  function copyRange(columns: TanstackColumnDef<Row>[], data: Row[], from: [string, string], to: [string, string]) {
    const { result } = renderHook(() => {
      const table = useTable({
        features: jetstreamTableFeatures,
        data,
        columns,
        getRowId: (row) => row._key,
      }) as unknown as TanstackTable<Row>;
      return useGridKeyboardNavigation({ table, getRootElement: () => null });
    });
    act(() => result.current.handleCellMouseDown(from[0], from[1], false));
    act(() => result.current.handleCellMouseEnter(to[0], to[1]));
    act(() => result.current.copySelection());
    return copyRecordsToClipboard.mock.calls[0][0] as Record<string, string>[];
  }

  test('skips placeholder spanner rows so they do not land as blank lines mid-range', () => {
    // Rows '2' and '3' are spanners with nothing to copy; '4' must still follow '1' with no gap.
    expect(copyRange(spannerColumns, spannerData, ['1', 'Name'], ['4', 'Amount'])).toEqual([
      { c0: 'Alpha', c1: '10' },
      { c0: 'Delta', c1: '40' },
    ]);
  });

  test('keeps genuinely empty DATA rows — dropping them would misalign everything below', () => {
    const emptyData: Row[] = [
      { _key: '1', Name: 'Alpha', Amount: '10' },
      { _key: '2', Name: '', Amount: '' },
      { _key: '3', Name: 'Charlie', Amount: '30' },
    ];
    expect(copyRange(columns, emptyData, ['1', 'Name'], ['3', 'Amount'])).toEqual([
      { c1: 'Alpha', c2: '10' },
      { c1: '', c2: '' },
      { c1: 'Charlie', c2: '30' },
    ]);
  });
});

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

describe('useGridKeyboardNavigation — empty body (a filter matched zero rows)', () => {
  test('Tab-in seeds the header row so the column filters stay reachable', () => {
    const { result } = renderNav({ data: [] });
    const rootEl = document.createElement('div');

    act(() => result.current.keyboardNav.handleRootFocus({ target: rootEl, currentTarget: rootEl } as never));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: SELECT_COLUMN_KEY });
  });

  test('header navigation still works: arrows move between header cells, Down stays on the header', () => {
    const { result } = renderNav({ data: [] });
    act(() => result.current.keyboardNav.handleHeaderCellMouseDown('Name'));

    act(() => result.current.keyboardNav.handleKeyDown(keyEvent('ArrowRight')));
    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: 'Amount' });

    // There is no body row to step into — Down is swallowed and focus stays on the header.
    act(() => result.current.keyboardNav.handleKeyDown(keyEvent('ArrowDown')));
    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: 'Amount' });

    act(() => result.current.keyboardNav.handleKeyDown(keyEvent('ArrowLeft')));
    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: 'Name' });
  });

  test('a stale active cell (its row was filtered away) snaps to the header row and keeps its column', () => {
    const { result } = renderNav({ data: [] });
    // The user was on a body cell when the filter removed every row from under it.
    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Amount', false));

    act(() => result.current.keyboardNav.handleKeyDown(keyEvent('ArrowUp')));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: 'Amount' });
  });

  test('arrow keys with no active cell at all land on the header row instead of dying', () => {
    const { result } = renderNav({ data: [] });

    act(() => result.current.keyboardNav.handleKeyDown(keyEvent('ArrowDown')));

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: SELECT_COLUMN_KEY });
  });
});

describe('useGridKeyboardNavigation — focus return after an overlay closes', () => {
  function buildGridDom(cells: { rowId: string; columnId: string }[]) {
    const root = document.createElement('div');
    const cellElements = cells.map(({ rowId, columnId }) => {
      const cellEl = document.createElement('div');
      cellEl.setAttribute('data-row-id', rowId);
      cellEl.setAttribute('data-col-id', columnId);
      cellEl.tabIndex = -1;
      root.appendChild(cellEl);
      return cellEl;
    });
    document.body.appendChild(root);
    const overlay = document.createElement('div');
    overlay.className = 'slds-popover';
    const overlayInput = document.createElement('input');
    overlay.appendChild(overlayInput);
    document.body.appendChild(overlay);
    return { root, cellElements, overlay, overlayInput, cleanup: () => [root, overlay].forEach((el) => el.remove()) };
  }

  test('an overlay that unmounts with focus inside it (no focusout fires) still returns focus to the cell', async () => {
    const { root, cellElements, overlay, overlayInput, cleanup } = buildGridDom([{ rowId: HEADER_ROW_ID, columnId: 'Name' }]);
    const [headerCellEl] = cellElements;
    const trigger = document.createElement('button');
    headerCellEl.appendChild(trigger);
    const { result } = renderNav({ rootElement: root });

    act(() => result.current.keyboardNav.handleHeaderCellMouseDown('Name'));
    // Focus enters the overlay — arms the pending return-focus cell.
    act(() => overlayInput.focus());
    // The overlay unmounts WITH focus inside it: the browser fires no focusout for the removed node;
    // the overlay's own returnFocus then lands on the trigger, and that focusin is the only signal.
    act(() => overlay.remove());
    act(() => trigger.focus());
    await flushFrame();

    expect(document.activeElement).toBe(headerCellEl);
    cleanup();
  });

  test('when the originating row was filtered away, focus lands on the header cell of the same column', async () => {
    // Only the header cell exists in the DOM — the body row the overlay was opened from is gone.
    const { root, overlay, overlayInput, cleanup } = buildGridDom([{ rowId: HEADER_ROW_ID, columnId: 'Name' }]);
    const { result } = renderNav({ data: [], rootElement: root });

    act(() => result.current.keyboardNav.handleCellMouseDown('1', 'Name', false));
    act(() => overlayInput.focus());
    // Focus leaves the overlay for nowhere in particular (it closes), so focus falls to <body>.
    act(() => overlayInput.blur());
    await flushFrame();
    act(() => overlay.remove());
    act(() => document.dispatchEvent(new FocusEvent('focusout')));
    await flushFrame();

    expect(result.current.keyboardNav.activeCell).toEqual({ rowId: HEADER_ROW_ID, columnId: 'Name' });
    cleanup();
  });
});
