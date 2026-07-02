/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import type { Column, Row, Table } from '@tanstack/react-table';
import { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ActiveCell } from '../components/GridRow';
import { getSummaryRowId, getSummaryRowIndex, HEADER_ROW_ID, isSummaryRowId, SELECT_COLUMN_KEY } from '../grid-constants';
import { ColSpanArgs } from '../grid-types';

export type GridMode = 'navigation' | 'actionable';

/** Rows to jump on PageUp/PageDown (approximate viewport page). */
const PAGE_SIZE = 12;

/**
 * Interactive controls inside a cell that Space/Enter can "activate" (and that Tab cycles in actionable
 * mode). Deliberately does NOT exclude `tabindex="-1"` — in-cell controls are removed from the page tab
 * order (the grid is a single tab stop), so they are reached only via this keyboard model, not Tab.
 * `[aria-haspopup]` matches floating-ui popover triggers (useRole adds `aria-haspopup="dialog"`).
 */
const ACTIVATABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [aria-haspopup]';

/** A rectangular cell-selection in display-index space (inclusive bounds). */
export interface SelectionRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Column indexes at which a row starts a (possibly multi-column) rendered cell — i.e. the navigable
 * positions for that row. Cells honor colSpan (GROUP for group headers, ROW for data rows), so a
 * spanned-over column has no DOM cell to focus; nav must step between, and snap onto, these owners.
 */
function getRowSegmentStarts<TRow>(row: Row<TRow>, columns: Column<TRow, unknown>[]): number[] {
  const grouped = row.getIsGrouped();
  if (grouped) {
    // When no column supplies a group cell, GridGroupRow renders ONE full-width header at the first
    // column (the fallback) — its only navigable position is column 0.
    const anyGroupCell = columns.some((column) => column.columnDef.meta?.jetstream?.renderGroupCell);
    if (!anyGroupCell) {
      return [0];
    }
  }
  const representative = grouped ? row.getLeafRows()[0]?.original : row.original;
  const colSpanArgs: ColSpanArgs<TRow> = grouped ? { type: 'GROUP', row: representative } : { type: 'ROW', row: representative as TRow };
  const starts: number[] = [];
  let index = 0;
  while (index < columns.length) {
    starts.push(index);
    const span = Math.max(1, columns[index].columnDef.meta?.jetstream?.colSpan?.(colSpanArgs) ?? 1);
    index += span;
  }
  return starts;
}

/** The segment owner (start index) of the cell that covers `targetColIndex` in `row`. For a row with no
 * spans this is `targetColIndex` itself; for a spanned cell it's the column that renders it. */
function resolveColumnStart<TRow>(row: Row<TRow>, columns: Column<TRow, unknown>[], targetColIndex: number): number {
  const starts = getRowSegmentStarts(row, columns);
  let owner = starts[0] ?? 0;
  for (const start of starts) {
    if (start <= targetColIndex) {
      owner = start;
    } else {
      break;
    }
  }
  return owner;
}

function cellText<TRow>(row: Row<TRow>, column: Column<TRow, unknown>): string {
  // Synthetic group header rows have no original row data.
  if (row.original === null || row.original === undefined) {
    return '';
  }
  const authorColumn = column.columnDef.meta?.jetstream?.column;
  let value: unknown = authorColumn?.getValue
    ? authorColumn.getValue({ row: row.original, column: authorColumn })
    : (row.original as Record<string, unknown>)[column.id];
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Display label for a column header, used when copying a selection "with header". Falls back to the
 * string header / column id when the author's `name` is a ReactNode. */
function headerText<TRow>(column: Column<TRow, unknown>): string {
  const name = column.columnDef.meta?.jetstream?.column?.name;
  if (typeof name === 'string') {
    return name;
  }
  const header = column.columnDef.header;
  if (typeof header === 'string') {
    return header;
  }
  return column.id;
}

export interface UseGridKeyboardNavigationOptions<TRow> {
  table: Table<TRow>;
  /** Returns the grid root element so DOM focus/copy queries are scoped to this grid instance. */
  getRootElement: () => HTMLElement | null;
  /** Enter/F2 hook: if it starts editing the cell (returns true), the grid stays out of Actionable mode. */
  onRequestEdit?: (cell: ActiveCell) => boolean;
  /** Return true to keep the active cell/selection when focus leaves the grid root — used when focus
   * moves into the grid's own portaled UI (context menu, popover editor), which must keep acting on
   * the current selection. */
  shouldRetainFocusOnBlur?: (relatedTarget: Node | null) => boolean;
  /** Number of pinned summary rows. They sit between the header and the body in the navigation order so
   * arrows can step into them (e.g. column filter inputs, bulk select-all/none/reset actions). */
  summaryRowCount?: number;
  /** Emit a message to the grid's polite live region (e.g. "Copied 3 rows by 2 columns") so screen-reader
   * users get feedback for actions that are otherwise only visual. */
  onAnnounce?: (message: string) => void;
  /** Undo the last grid edit/paste (Ctrl/Cmd+Z). The consumer owns the row-snapshot history. */
  onUndo?: () => void;
  /** Redo the last undone edit (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y). */
  onRedo?: () => void;
  /** Clear the editable cells in the current selection (Delete/Backspace). */
  onClearSelection?: () => void;
}

export interface GridKeyboardNavigation {
  activeCell: ActiveCell | null;
  anchorCell: ActiveCell | null;
  mode: GridMode;
  setActiveCell: (cell: ActiveCell | null) => void;
  handleKeyDown: (event: ReactKeyboardEvent) => void;
  /** When the grid ROOT itself receives focus (Tab-in) and no cell is active, seed the first cell. Must
   * ignore focus bubbling up from descendants (header buttons, cells) or it would yank focus to (0,0). */
  handleRootFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  /** Whether the last active-cell change came from the mouse or keyboard — lets GridBody skip stealing
   * focus back to the cell on mouse clicks (which would close popovers opened from a cell). The
   * 'select-all' source additionally suppresses scroll-into-view (Ctrl+A must not jump the viewport). */
  getLastInteractionSource: () => 'mouse' | 'keyboard' | 'select-all';
  /** When focus leaves the grid entirely (e.g. Tab/Shift+Tab out), clear the active cell so the next
   * focus event re-seeds and the grid root re-enters the tab order. */
  handleRootBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  /** Mouse down on a cell — starts a (possibly shift-extended) selection / drag. Right-click keeps an
   * existing range when clicking inside it (spreadsheet behavior) so the context menu can act on it. */
  handleCellMouseDown: (rowId: string, columnId: string, shiftKey: boolean, button?: number) => void;
  /** Mouse enters a cell while dragging — extends the rectangular selection. */
  handleCellMouseEnter: (rowId: string, columnId: string) => void;
  /** Mouse down on a column header cell — makes it the keyboard-active cell (header row navigation). */
  handleHeaderCellMouseDown: (columnId: string) => void;
  /** Mouse down on a summary cell — makes it the keyboard-active cell (summary row navigation). */
  handleSummaryCellMouseDown: (rowId: string, columnId: string) => void;
  /** Copy the current selection (rectangle, or the single active cell) as TSV; optionally prepend a header row. */
  copySelection: (includeHeader?: boolean) => void;
}

/**
 * The grid's keyboard navigation / a11y state machine + rectangular cell selection.
 *
 *  - Navigation mode (default): a single roving `tabindex=0` cell; arrows move cell-to-cell.
 *  - Actionable mode: entered via Enter/F2; focusables inside the cell become reachable; Esc returns.
 *  - Selection: an `anchorCell` + the `activeCell` (focus) define a rectangle. Shift+Arrow, Shift+Click,
 *    and mouse-drag extend it; a plain Arrow/Click collapses it. Ctrl/Cmd+A selects all. Ctrl/Cmd+C
 *    copies the rectangle as TSV (Excel/Sheets-friendly), or the single active cell when collapsed.
 *
 * Focus + selection are stored as logical `{ rowId, columnId }` coordinates (not DOM nodes) so they
 * survive row virtualization recycling — GridBody resolves the active cell to a DOM element.
 */
export function useGridKeyboardNavigation<TRow>({
  table,
  getRootElement,
  onRequestEdit,
  shouldRetainFocusOnBlur,
  summaryRowCount = 0,
  onAnnounce,
  onUndo,
  onRedo,
  onClearSelection,
}: UseGridKeyboardNavigationOptions<TRow>): GridKeyboardNavigation {
  const [activeCell, setActiveCellState] = useState<ActiveCell | null>(null);
  const [anchorCell, setAnchorCell] = useState<ActiveCell | null>(null);
  const [mode, setMode] = useState<GridMode>('navigation');
  const isDraggingRef = useRef(false);
  // Tracks whether the most recent active-cell change was mouse- or keyboard-driven (see interface doc).
  const interactionSourceRef = useRef<'mouse' | 'keyboard' | 'select-all'>('keyboard');
  // The cell an activation opened a popover/modal from — focus is returned here once the overlay closes.
  const pendingReturnFocusCellRef = useRef<ActiveCell | null>(null);
  // Live mirror of activeCell for the document focus listeners (avoids re-subscribing on every move).
  const activeCellRef = useRef(activeCell);
  // eslint-disable-next-line react-hooks/refs
  activeCellRef.current = activeCell;
  // The column the user deliberately chose (last horizontal move / click). Vertical navigation targets
  // this column so passing through colSpan'd rows (group headers, "no rows" spanners) — which snap focus
  // onto a span owner — doesn't permanently drag the user to that owner's column. The classic
  // spreadsheet "sticky column" behavior.
  const desiredColRef = useRef<number | null>(null);

  // Stop drag-select when the mouse is released anywhere.
  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Apply a new active cell. `extend` keeps the existing anchor (range select); otherwise the anchor
  // collapses onto the new cell. `keepDesiredCol` is set by vertical moves so they don't overwrite the
  // user's sticky column with the (possibly snapped) column they're passing through.
  const applySelection = useCallback(
    (rowId: string, columnId: string, extend: boolean, keepDesiredCol = false) => {
      if (!keepDesiredCol) {
        const colIndex = table.getVisibleLeafColumns().findIndex((column) => column.id === columnId);
        if (colIndex >= 0) {
          desiredColRef.current = colIndex;
        }
      }
      setActiveCellState({ rowId, columnId });
      setMode('navigation');
      setAnchorCell((prevAnchor) => (extend && prevAnchor ? prevAnchor : { rowId, columnId }));
    },
    [table],
  );

  const setActiveCell = useCallback(
    (cell: ActiveCell | null) => {
      interactionSourceRef.current = 'keyboard';
      if (cell) {
        const colIndex = table.getVisibleLeafColumns().findIndex((column) => column.id === cell.columnId);
        if (colIndex >= 0) {
          desiredColRef.current = colIndex;
        }
      }
      setActiveCellState(cell);
      setAnchorCell(cell);
    },
    [table],
  );

  const moveTo = useCallback(
    (rowIndex: number, colIndex: number, extend: boolean, keepDesiredCol = false) => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (!rows.length || !columns.length) {
        return;
      }
      const nextRow = rows[clamp(rowIndex, 0, rows.length - 1)];
      const targetCol = clamp(colIndex, 0, columns.length - 1);
      // Snap the target column onto the cell that actually renders it for this row (honoring colSpan:
      // GROUP for group headers, ROW for data rows like a full-width "no rows found" message). Without
      // this, focus targets a column hidden under a span and the move silently no-ops.
      const nextColIndex = resolveColumnStart(nextRow, columns, targetCol);
      applySelection(nextRow.id, columns[nextColIndex].id, extend, keepDesiredCol);
    },
    [table, applySelection],
  );

  /**
   * After keyboard activation opens a Popover (which, unlike Modal, has no focus manager), move focus into
   * the popover's body so the keyboard lands inside it (e.g. a filter's search box). Retried across a few
   * frames while the portal mounts. No-op for Modals (they manage their own focus) and for activations
   * that didn't open a popover. Skips if focus already moved inside (an autofocused input).
   */
  const focusOpenedPopover = useCallback(() => {
    const root = getRootElement();
    let attempts = 0;
    const tryFocus = () => {
      const panel = Array.from(document.querySelectorAll<HTMLElement>('.slds-popover')).find((el) => !root || !el.contains(root));
      if (panel) {
        if (!panel.contains(document.activeElement)) {
          const body = panel.querySelector<HTMLElement>('.slds-popover__body');
          const focusable =
            body?.querySelector<HTMLElement>(ACTIVATABLE_SELECTOR) ?? panel.querySelector<HTMLElement>(ACTIVATABLE_SELECTOR) ?? null;
          focusable?.focus();
        }
        return;
      }
      if (attempts++ < 6) {
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
  }, [getRootElement]);

  /** Resolve a logical cell coordinate to its DOM element (scoped to this grid). Query by data attrs
   * rather than `document.activeElement` so it works even before the focus effect has landed. */
  const getCellElement = useCallback(
    (cell: ActiveCell): HTMLElement | null => {
      const root = getRootElement();
      return (
        root?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(cell.rowId)}"][data-col-id="${CSS.escape(cell.columnId)}"]`) ?? null
      );
    },
    [getRootElement],
  );

  /**
   * Activate the cell's interactive content from navigation mode (Space or Enter on a non-editable
   * cell). A lone checkbox toggles; a single popover/link/button is clicked (opens the popover); a cell
   * with several controls (e.g. the action cell) enters Actionable mode so Tab cycles them. A cell with
   * NO interactive content does nothing — it stays in navigation mode so the cell keeps focus and
   * arrows/Space keep working (entering Actionable mode there is a dead end that scrolls the page).
   * `.click()` works regardless of `tabindex`, so in-cell controls stay out of the page tab order.
   */
  const activateCell = useCallback(
    (cell: ActiveCell) => {
      const cellEl = getCellElement(cell);
      if (!cellEl) {
        return;
      }
      const checkboxes = cellEl.querySelectorAll<HTMLElement>('input[type="checkbox"]:not([disabled])');
      if (checkboxes.length === 1) {
        checkboxes[0].click();
        return;
      }
      const controls = cellEl.querySelectorAll<HTMLElement>(ACTIVATABLE_SELECTOR);
      // A lone text input / textarea / select (e.g. a column filter cell) is focused for typing via
      // Actionable mode — a programmatic `.click()` wouldn't move focus into it, and Actionable mode lets
      // Escape return to the cell. The mode change drives the focus effect to focus the input.
      const loneTextInput =
        controls.length === 1 &&
        controls[0].matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select');
      if (loneTextInput) {
        setMode('actionable');
        return;
      }
      if (controls.length === 1) {
        // A single control is typically a popover/modal trigger — remember the cell so focus returns
        // here when that overlay closes (no-op if the control acts inline and never moves focus away).
        pendingReturnFocusCellRef.current = cell;
        controls[0].click();
        // If it opened a popover, move focus into it (Modals manage their own focus, so this no-ops there).
        focusOpenedPopover();
        return;
      }
      if (controls.length > 1) {
        setMode('actionable');
      }
    },
    [getCellElement, focusOpenedPopover],
  );

  /**
   * Activate a column header control. Headers deliberately do NOT use Actionable mode (it traps focus in
   * a way that's confusing in a one-row header) — instead Enter prefers sort and Space prefers the filter,
   * so a column that is both sortable and filterable exposes both via the keyboard. A select-all checkbox
   * is always toggled. The filter trigger opens a popover, so focus-return is armed for it.
   */
  const activateHeaderCell = useCallback(
    (columnId: string, prefer: 'sort' | 'filter') => {
      const cellEl = getCellElement({ rowId: HEADER_ROW_ID, columnId });
      if (!cellEl) {
        return;
      }
      const checkbox = cellEl.querySelector<HTMLElement>('input[type="checkbox"]:not([disabled])');
      if (checkbox) {
        checkbox.click();
        return;
      }
      const filterTrigger = cellEl.querySelector<HTMLElement>(
        '.jgrid-header-filter-slot button, .jgrid-header-filter-slot [aria-haspopup]',
      );
      const sortButton = cellEl.querySelector<HTMLElement>('.jgrid-header-sort-button');
      const target = prefer === 'filter' ? (filterTrigger ?? sortButton) : (sortButton ?? filterTrigger);
      if (!target) {
        return;
      }
      if (target === filterTrigger) {
        pendingReturnFocusCellRef.current = { rowId: HEADER_ROW_ID, columnId };
        target.click();
        // Move keyboard focus into the filter popover (e.g. its search box) once it mounts.
        focusOpenedPopover();
        return;
      }
      target.click();
    },
    [getCellElement, focusOpenedPopover],
  );

  // Return focus to the originating cell after a popover/modal opened from the grid closes. The grid
  // retains the active cell across the open (shouldRetainFocusOnBlur), but DOM focus moves into the
  // overlay; when it closes and focus would fall to <body>, pull it back to the cell so arrow navigation
  // continues. Works for popovers/modals opened by mouse OR keyboard, from a body cell or the header.
  useEffect(() => {
    // Returns overlays (portaled popovers/modals) that are NOT an ancestor of this grid — i.e. a popover
    // opened FROM the grid, excluding a modal that merely hosts the grid.
    const hasForeignOverlayOpen = () => {
      const root = getRootElement();
      return Array.from(document.querySelectorAll('.slds-popover, .slds-modal, [role="dialog"]')).some(
        (overlay) => !root || !overlay.contains(root),
      );
    };

    // When focus moves into such an overlay, remember the active cell so we can restore it on close.
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const overlay = target?.closest?.('.slds-popover, .slds-modal, [role="dialog"]');
      const root = getRootElement();
      if (overlay && (!root || !overlay.contains(root)) && activeCellRef.current) {
        pendingReturnFocusCellRef.current = activeCellRef.current;
      }
    };

    const handleFocusOut = () => {
      if (!pendingReturnFocusCellRef.current) {
        return;
      }
      requestAnimationFrame(() => {
        const cell = pendingReturnFocusCellRef.current;
        if (!cell) {
          return;
        }
        // Wait while the overlay is still up (e.g. tabbing within it).
        if (hasForeignOverlayOpen()) {
          return;
        }
        pendingReturnFocusCellRef.current = null;
        const active = document.activeElement as HTMLElement | null;
        const cellEl = getCellElement(cell);
        // Refocus the originating cell when focus fell to <body>, OR when the overlay's `returnFocus` put
        // it back on a control INSIDE that cell (e.g. a header filter icon after Escape). Otherwise DOM
        // focus sits on the in-cell control and arrow navigation can't resume — the cell is the rover.
        const focusReturnedInsideCell = !!cellEl && !!active && active !== cellEl && cellEl.contains(active);
        if (!active || active === document.body || focusReturnedInsideCell) {
          cellEl?.focus();
        }
      });
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [getCellElement, getRootElement]);

  const handleRootFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      // Only seed when the grid root ITSELF received focus (Tab-in). `onFocus` bubbles, so focus landing
      // on a descendant (header filter button, a cell) would otherwise seed (0,0) and yank focus/scroll
      // to the far-left column — exactly the "first header click jumps left" bug.
      if (event.target !== event.currentTarget || activeCell) {
        return;
      }
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (rows.length && columns.length) {
        interactionSourceRef.current = 'keyboard';
        applySelection(rows[0].id, columns[0].id, false);
      }
    },
    [activeCell, table, applySelection],
  );

  // When focus leaves the grid (Tab/Shift+Tab out, click outside), drop the active cell so the grid
  // root re-enters the tab order and the next focus event re-seeds via handleRootFocus.
  const handleRootBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) {
        return;
      }
      if (shouldRetainFocusOnBlur?.(next)) {
        return;
      }
      setActiveCellState(null);
      setAnchorCell(null);
      setMode('navigation');
    },
    [shouldRetainFocusOnBlur],
  );

  /** True when the cell falls inside the current (possibly single-cell) selection rectangle. */
  const isCellInSelection = useCallback(
    (rowId: string, columnId: string): boolean => {
      if (!activeCell) {
        return false;
      }
      const anchor = anchorCell ?? activeCell;
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      const rowIndex = rows.findIndex((row) => row.id === rowId);
      const colIndex = columns.findIndex((column) => column.id === columnId);
      const activeRowIndex = rows.findIndex((row) => row.id === activeCell.rowId);
      const anchorRowIndex = rows.findIndex((row) => row.id === anchor.rowId);
      const activeColIndex = columns.findIndex((column) => column.id === activeCell.columnId);
      const anchorColIndex = columns.findIndex((column) => column.id === anchor.columnId);
      if (rowIndex < 0 || colIndex < 0 || activeRowIndex < 0 || anchorRowIndex < 0 || activeColIndex < 0 || anchorColIndex < 0) {
        return false;
      }
      return (
        rowIndex >= Math.min(activeRowIndex, anchorRowIndex) &&
        rowIndex <= Math.max(activeRowIndex, anchorRowIndex) &&
        colIndex >= Math.min(activeColIndex, anchorColIndex) &&
        colIndex <= Math.max(activeColIndex, anchorColIndex)
      );
    },
    [activeCell, anchorCell, table],
  );

  const handleCellMouseDown = useCallback(
    (rowId: string, columnId: string, shiftKey: boolean, button = 0) => {
      // Right/middle click: never start a drag. Right-click inside the current selection keeps it
      // (the context menu acts on the range — spreadsheet behavior); outside it, move the selection.
      if (button !== 0) {
        if (button === 2 && !isCellInSelection(rowId, columnId)) {
          interactionSourceRef.current = 'mouse';
          applySelection(rowId, columnId, false);
        }
        return;
      }
      interactionSourceRef.current = 'mouse';
      // The select column owns Shift for checkbox range selection (SelectFormatter); never let a
      // Shift-click there extend the rectangular cell selection. Still set the active cell so keyboard
      // navigation continues from the checkbox.
      if (shiftKey && columnId !== SELECT_COLUMN_KEY) {
        applySelection(rowId, columnId, true);
      } else {
        applySelection(rowId, columnId, false);
        isDraggingRef.current = true;
      }
    },
    [applySelection, isCellInSelection],
  );

  const handleCellMouseEnter = useCallback(
    (rowId: string, columnId: string) => {
      if (isDraggingRef.current) {
        interactionSourceRef.current = 'mouse';
        applySelection(rowId, columnId, true);
      }
    },
    [applySelection],
  );

  // Mouse-down on a header cell makes it the keyboard-active cell so arrow nav continues from the header.
  // Source 'mouse' so GridBody doesn't steal focus from the control the user actually clicked (sort/filter).
  const handleHeaderCellMouseDown = useCallback(
    (columnId: string) => {
      interactionSourceRef.current = 'mouse';
      applySelection(HEADER_ROW_ID, columnId, false);
    },
    [applySelection],
  );

  // Mouse-down on a summary cell makes it the keyboard-active cell so arrow nav continues from there.
  // Source 'mouse' so the body's focus effect doesn't steal focus from the control the user clicked.
  const handleSummaryCellMouseDown = useCallback(
    (rowId: string, columnId: string) => {
      interactionSourceRef.current = 'mouse';
      applySelection(rowId, columnId, false);
    },
    [applySelection],
  );

  const copySelection = useCallback(
    (includeHeader = false) => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (!activeCell || !rows.length || !columns.length) {
        return;
      }
      const anchor = anchorCell ?? activeCell;
      const activeRowIndex = rows.findIndex((row) => row.id === activeCell.rowId);
      const anchorRowIndex = rows.findIndex((row) => row.id === anchor.rowId);
      const activeColIndex = columns.findIndex((column) => column.id === activeCell.columnId);
      const anchorColIndex = columns.findIndex((column) => column.id === anchor.columnId);
      if (activeRowIndex < 0 || anchorRowIndex < 0 || activeColIndex < 0 || anchorColIndex < 0) {
        return;
      }
      const minRow = Math.min(activeRowIndex, anchorRowIndex);
      const maxRow = Math.max(activeRowIndex, anchorRowIndex);
      const minCol = Math.min(activeColIndex, anchorColIndex);
      const maxCol = Math.max(activeColIndex, anchorColIndex);

      // Build records keyed by synthetic field names (avoids dot-notation flattening on real column ids),
      // then reuse copyRecordsToClipboard which writes BOTH text/html (a table) and an escaped text/plain
      // Excel string — so it pastes into Excel/Sheets as a proper grid (handles tabs/newlines/quotes in cells).
      const fields: string[] = [];
      for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
        fields.push(`c${colIndex}`);
      }
      const records: Record<string, string>[] = [];
      // "With header": prepend the selected columns' display names as the first row (kept as data, keyed by
      // the same synthetic fields, so the existing dot-notation-safe copy path is reused unchanged).
      if (includeHeader) {
        const headerRecord: Record<string, string> = {};
        for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
          headerRecord[`c${colIndex}`] = headerText(columns[colIndex]);
        }
        records.push(headerRecord);
      }
      for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
        // Synthetic group header rows have no cell data — skip them so pasted output stays rectangular.
        if (rows[rowIndex].getIsGrouped()) {
          continue;
        }
        const record: Record<string, string> = {};
        for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
          record[`c${colIndex}`] = cellText(rows[rowIndex], columns[colIndex]);
        }
        records.push(record);
      }
      void copyRecordsToClipboard(records, 'excel', fields, false);
      flashCells(getRootElement(), rows, columns, minRow, maxRow, minCol, maxCol);

      const copiedRowCount = records.length - (includeHeader ? 1 : 0);
      const copiedColCount = fields.length;
      onAnnounce?.(
        `Copied ${copiedRowCount} ${copiedRowCount === 1 ? 'row' : 'rows'} by ${copiedColCount} ${
          copiedColCount === 1 ? 'column' : 'columns'
        }`,
      );
    },
    [activeCell, anchorCell, table, getRootElement, onAnnounce],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (!rows.length || !columns.length) {
        return;
      }
      interactionSourceRef.current = 'keyboard';

      const current: ActiveCell = activeCell ?? { rowId: rows[0].id, columnId: columns[0].id };
      const rowIndex = Math.max(
        0,
        rows.findIndex((row) => row.id === current.rowId),
      );
      const colIndex = Math.max(
        0,
        columns.findIndex((column) => column.id === current.columnId),
      );
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const extend = event.shiftKey;

      // Mark a key as consumed by THIS grid. Stopping propagation prevents the event from bubbling
      // through the React tree to an ancestor grid — without it, a nested grid (e.g. the subquery
      // modal table) would also drive the underlying page's table, since React portals propagate
      // synthetic events through the component tree rather than the DOM tree.
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      // ── Actionable mode: Tab/Shift+Tab and Arrow Left/Right cycle the cell's controls (they're out of
      // the page tab order, so we move focus ourselves and trap it within the cell); Up/Down are swallowed
      // so they don't scroll the page; Escape returns focus to the cell. Other keys are the focused
      // control's own behavior (e.g. Space/Enter toggles the focused checkbox or clicks the button). ──
      if (mode === 'actionable') {
        if (event.key === 'Escape') {
          consume();
          setMode('navigation');
          // Pull focus off the in-cell control back onto the cell so navigation resumes from here.
          if (activeCell) {
            getCellElement(activeCell)?.focus();
          }
          return;
        }
        const forward = event.key === 'Tab' ? !event.shiftKey : event.key === 'ArrowRight';
        const backward = event.key === 'Tab' ? event.shiftKey : event.key === 'ArrowLeft';
        if (forward || backward) {
          if (!activeCell) {
            return;
          }
          const cellEl = getCellElement(activeCell);
          const controls = cellEl ? Array.from(cellEl.querySelectorAll<HTMLElement>(ACTIVATABLE_SELECTOR)) : [];
          if (controls.length > 1) {
            consume();
            const currentIndex = controls.findIndex(
              (control) => control === document.activeElement || control.contains(document.activeElement),
            );
            const nextIndex = (currentIndex + (backward ? -1 : 1) + controls.length) % controls.length;
            controls[nextIndex].focus();
          }
          return;
        }
        // Keep Up/Down from scrolling the page while interacting with the cell's controls.
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          consume();
        }
        return;
      }

      // ── Column header row (a virtual row above the body) ──
      // Left/Right move between header cells, Down/Escape return to the body, Up is swallowed (already at
      // the top), and Enter/Space/F2 activate the header's controls (sort / filter popover / select-all).
      if (activeCell?.rowId === HEADER_ROW_ID) {
        const headerColIndex = Math.max(
          0,
          columns.findIndex((column) => column.id === activeCell.columnId),
        );
        switch (event.key) {
          case 'ArrowDown':
            consume();
            // Step into the summary rows if present (column filters / bulk actions), else the body.
            // keepDesiredCol: a vertical step must not overwrite the sticky column when snapping.
            if (summaryRowCount > 0) {
              applySelection(getSummaryRowId(0), columns[headerColIndex].id, false, true);
            } else {
              moveTo(0, headerColIndex, false, true);
            }
            break;
          case 'Escape':
            consume();
            // Escape jumps straight to the data (skipping the summary rows). moveTo handles group snapping.
            moveTo(0, headerColIndex, false, true);
            break;
          case 'ArrowUp':
            consume();
            break;
          case 'ArrowRight':
            consume();
            applySelection(HEADER_ROW_ID, columns[clamp(headerColIndex + 1, 0, columns.length - 1)].id, false);
            break;
          case 'ArrowLeft':
            consume();
            applySelection(HEADER_ROW_ID, columns[clamp(headerColIndex - 1, 0, columns.length - 1)].id, false);
            break;
          case 'Home':
            consume();
            applySelection(HEADER_ROW_ID, columns[0].id, false);
            break;
          case 'End':
            consume();
            applySelection(HEADER_ROW_ID, columns[columns.length - 1].id, false);
            break;
          case 'Enter':
          case 'F2':
            // Let Cmd/Ctrl+Enter bubble to app-level handlers (e.g. save).
            if (event.key === 'Enter' && ctrlOrMeta) {
              break;
            }
            consume();
            // Enter prefers sort (matches clicking the header); a select-all column toggles its checkbox.
            activateHeaderCell(columns[headerColIndex].id, 'sort');
            break;
          case ' ':
            consume();
            // Space prefers the filter popover (the control that's otherwise hard to reach by keyboard).
            activateHeaderCell(columns[headerColIndex].id, 'filter');
            break;
          default:
            break;
        }
        return;
      }

      // ── Pinned summary rows (filters / bulk actions, between the header and the body) ──
      // Left/Right move between summary cells; Up/Down step through the summary stack into the header
      // (above) or the body (below); Enter/Space/F2 activate the cell's controls (a single control
      // clicks, multiple controls — e.g. select-all/none/reset — enter Actionable mode so Tab cycles
      // them); Escape drops to the body. Range-extend (Shift) is intentionally not supported here.
      if (activeCell && isSummaryRowId(activeCell.rowId)) {
        const summaryIndex = getSummaryRowIndex(activeCell.rowId);
        const summaryColIndex = Math.max(
          0,
          columns.findIndex((column) => column.id === activeCell.columnId),
        );
        switch (event.key) {
          case 'ArrowRight':
            consume();
            applySelection(activeCell.rowId, columns[clamp(summaryColIndex + 1, 0, columns.length - 1)].id, false);
            break;
          case 'ArrowLeft':
            consume();
            applySelection(activeCell.rowId, columns[clamp(summaryColIndex - 1, 0, columns.length - 1)].id, false);
            break;
          case 'Home':
            consume();
            applySelection(activeCell.rowId, columns[0].id, false);
            break;
          case 'End':
            consume();
            applySelection(activeCell.rowId, columns[columns.length - 1].id, false);
            break;
          case 'ArrowDown':
            consume();
            if (summaryIndex + 1 < summaryRowCount) {
              applySelection(getSummaryRowId(summaryIndex + 1), columns[summaryColIndex].id, false, true);
            } else {
              moveTo(0, summaryColIndex, false, true);
            }
            break;
          case 'ArrowUp':
            consume();
            if (summaryIndex > 0) {
              applySelection(getSummaryRowId(summaryIndex - 1), columns[summaryColIndex].id, false, true);
            } else {
              applySelection(HEADER_ROW_ID, columns[summaryColIndex].id, false, true);
            }
            break;
          case 'Escape':
            consume();
            moveTo(0, summaryColIndex, false, true);
            break;
          case 'Enter':
          case 'F2':
          case ' ':
            // Let Cmd/Ctrl+Enter bubble to app-level handlers (e.g. save).
            if (event.key === 'Enter' && ctrlOrMeta) {
              break;
            }
            consume();
            // Summary cells are never editable — activate their controls directly (no edit path).
            activateCell(activeCell);
            break;
          default:
            break;
        }
        return;
      }

      // ── Navigation mode ──
      // Vertical moves target the sticky desired column (not the possibly-snapped current column), so
      // passing through a group header or a spanned "no rows" row doesn't drag the user sideways.
      const desiredCol = clamp(desiredColRef.current ?? colIndex, 0, columns.length - 1);
      switch (event.key) {
        case 'ArrowDown':
          consume();
          moveTo(rowIndex + 1, desiredCol, extend, true);
          break;
        case 'ArrowUp':
          consume();
          // From the first body row, Up enters the pinned summary rows (filters / bulk actions) if any,
          // otherwise the column header row — so the keyboard can reach both. A range-extend (Shift)
          // stays in the body.
          if (rowIndex === 0 && !extend) {
            applySelection(summaryRowCount > 0 ? getSummaryRowId(summaryRowCount - 1) : HEADER_ROW_ID, columns[desiredCol].id, false, true);
          } else {
            moveTo(rowIndex - 1, desiredCol, extend, true);
          }
          break;
        case 'ArrowRight': {
          consume();
          const currentRow = rows[rowIndex];
          if (currentRow?.getIsGrouped()) {
            // Group header rows: step to the next group cell (segment). Arrows NEVER expand/collapse —
            // Enter/Space on the chevron cell does that (and on the select-all cell toggles its checkbox).
            const starts = getRowSegmentStarts(currentRow, columns);
            const segmentIndex = Math.max(0, starts.filter((start) => start <= colIndex).length - 1);
            applySelection(currentRow.id, columns[starts[clamp(segmentIndex + 1, 0, starts.length - 1)]].id, false);
          } else if (!extend && currentRow?.getCanExpand() && !currentRow.getIsExpanded()) {
            // Tree (real data row with children): Right expands a collapsed row.
            currentRow.toggleExpanded();
          } else {
            moveTo(rowIndex, colIndex + 1, extend);
          }
          break;
        }
        case 'ArrowLeft': {
          consume();
          const currentRow = rows[rowIndex];
          if (currentRow?.getIsGrouped()) {
            // Group header rows: step to the previous group cell (segment); no arrow-driven collapse.
            const starts = getRowSegmentStarts(currentRow, columns);
            const segmentIndex = Math.max(0, starts.filter((start) => start <= colIndex).length - 1);
            applySelection(currentRow.id, columns[starts[clamp(segmentIndex - 1, 0, starts.length - 1)]].id, false);
          } else if (colIndex === 0 && !extend && currentRow?.getCanExpand() && currentRow.getIsExpanded()) {
            // Tree: collapse an expanded row at the first column.
            currentRow.toggleExpanded();
          } else if (colIndex === 0 && !extend && currentRow && currentRow.depth > 0) {
            // Jump from a nested/grouped child row to its parent (group/tree header) row.
            const parent = currentRow.getParentRow();
            const parentIndex = parent ? rows.findIndex((row) => row.id === parent.id) : -1;
            moveTo(parentIndex >= 0 ? parentIndex : rowIndex, parentIndex >= 0 ? colIndex : colIndex - 1, extend);
          } else {
            moveTo(rowIndex, colIndex - 1, extend);
          }
          break;
        }
        case 'Home':
          consume();
          moveTo(ctrlOrMeta ? 0 : rowIndex, 0, extend);
          break;
        case 'End':
          consume();
          moveTo(ctrlOrMeta ? rows.length - 1 : rowIndex, columns.length - 1, extend);
          break;
        case 'PageDown':
          consume();
          moveTo(rowIndex + PAGE_SIZE, desiredCol, extend, true);
          break;
        case 'PageUp':
          consume();
          moveTo(rowIndex - PAGE_SIZE, desiredCol, extend, true);
          break;
        case 'a':
        case 'A':
          if (ctrlOrMeta) {
            consume();
            // 'select-all' suppresses scroll-into-view/focus of the new active corner — selecting
            // everything must not jump the viewport to the bottom-right of the grid.
            interactionSourceRef.current = 'select-all';
            setActiveCellState({ rowId: rows[rows.length - 1].id, columnId: columns[columns.length - 1].id });
            setAnchorCell({ rowId: rows[0].id, columnId: columns[0].id });
          }
          break;
        case ' ':
          // Always consume Space so it can never scroll the virtualized body (which would unmount the
          // active row and drop focus out of the grid). Activate the cell's content only once the user
          // is actually in the grid; modified Space is left to the browser / assistive tech.
          consume();
          if (activeCell && !ctrlOrMeta && !event.altKey) {
            activateCell(current);
          }
          break;
        case 'Enter':
        case 'F2':
          // Let Cmd/Ctrl+Enter bubble to app-level handlers (e.g. "save edited records") instead of
          // treating it as edit/activate.
          if (event.key === 'Enter' && ctrlOrMeta) {
            break;
          }
          consume();
          applySelection(current.rowId, current.columnId, false);
          // Editable cells open their editor; otherwise activate the cell's content (toggle a checkbox /
          // open a popover), falling back to Actionable mode for multi-control cells. Group header cells
          // are never editable — go straight to activation (chevron cell toggles, select-all cell checks).
          if (rows[rowIndex]?.getIsGrouped() || !(onRequestEdit && onRequestEdit(current))) {
            activateCell(current);
          }
          break;
        case 'c':
        case 'C':
          if (ctrlOrMeta) {
            event.stopPropagation();
            copySelection();
          }
          break;
        case 'z':
        case 'Z':
          // Undo (Ctrl/Cmd+Z); Shift adds Redo. Only consume when the consumer supports it — otherwise
          // let the browser's native undo through. The cell editor is portaled outside the grid, so this
          // never fires while editing (the input keeps its own native undo).
          if (ctrlOrMeta) {
            if (event.shiftKey) {
              if (onRedo) {
                consume();
                onRedo();
              }
            } else if (onUndo) {
              consume();
              onUndo();
            }
          }
          break;
        case 'y':
        case 'Y':
          // Windows-style redo.
          if (ctrlOrMeta && !event.shiftKey && onRedo) {
            consume();
            onRedo();
          }
          break;
        case 'Delete':
        case 'Backspace':
          // Clear the editable cells in the current selection (single cell or range). The consumer
          // resolves which cells are editable + how to empty each type; non-data cells no-op there.
          if (onClearSelection) {
            consume();
            onClearSelection();
          }
          break;
        default:
          break;
      }
    },
    [
      activeCell,
      mode,
      table,
      moveTo,
      applySelection,
      copySelection,
      onRequestEdit,
      activateCell,
      activateHeaderCell,
      getCellElement,
      summaryRowCount,
      onUndo,
      onRedo,
      onClearSelection,
    ],
  );

  return {
    activeCell,
    anchorCell,
    mode,
    setActiveCell,
    handleKeyDown,
    handleRootFocus,
    handleRootBlur,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleHeaderCellMouseDown,
    handleSummaryCellMouseDown,
    copySelection,
    getLastInteractionSource: () => interactionSourceRef.current,
  };
}

function flashCells<TRow>(
  root: HTMLElement | null,
  rows: Row<TRow>[],
  columns: Column<TRow, unknown>[],
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number,
) {
  if (!root) {
    return;
  }
  // Only the virtualized window is in the DOM, so walk the MOUNTED cells and test range membership —
  // never querySelector per (row × col) pair, which freezes the tab on a Ctrl+A over a large result set.
  const rowIdsInRange = new Set<string>();
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
    rowIdsInRange.add(rows[rowIndex].id);
  }
  const colIdsInRange = new Set<string>();
  for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
    colIdsInRange.add(columns[colIndex].id);
  }
  const flashed: Element[] = [];
  root.querySelectorAll('[data-row-id][data-col-id]').forEach((cellEl) => {
    const rowId = cellEl.getAttribute('data-row-id');
    const colId = cellEl.getAttribute('data-col-id');
    if (rowId && colId && rowIdsInRange.has(rowId) && colIdsInRange.has(colId)) {
      cellEl.classList.add('copied');
      flashed.push(cellEl);
    }
  });
  setTimeout(() => flashed.forEach((cellEl) => cellEl.classList.remove('copied')), 600);
}
