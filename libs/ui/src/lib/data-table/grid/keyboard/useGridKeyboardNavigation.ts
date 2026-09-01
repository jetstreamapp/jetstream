/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard, transformTabularDataToExcelStr } from '@jetstream/shared/ui-utils';
import { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { isFrozenColumn } from '../components/grid-layout';
import { ActiveCell } from '../components/GridRow';
import { getCellText, getColumnHeaderText } from '../grid-clipboard';
import { getSummaryRowId, getSummaryRowIndex, HEADER_ROW_ID, isSummaryRowId, SELECT_COLUMN_KEY } from '../grid-constants';
import { ColSpanArgs, TanstackColumn, TanstackRow, TanstackTable } from '../grid-types';
import {
  addOrExcludeCellRange,
  clearCellSelection,
  collapseSelectionTo,
  extendActiveSelectionTo,
  getSelectionBounds,
  hasMultiCellSelection,
  isCellInSelectionBounds,
} from '../selection/grid-selection';
import { useRangeDragAutoScroll } from './useRangeDragAutoScroll';

export type GridMode = 'navigation' | 'actionable';

/**
 * Portaled overlays that can hold focus on behalf of the grid — popovers, modals, dropdown menus,
 * dialogs. Shared by every "is focus inside an overlay?" check (keyboard navigation, GridBody's
 * refocus guard, GridContainer's blur guard) so the list cannot drift between copies again — a
 * missing `.slds-dropdown` in one copy was a real bug.
 */
export const GRID_OVERLAY_SELECTOR = '.slds-popover, .slds-modal, .slds-dropdown, [role="dialog"]';

/**
 * What drove the most recent active-cell change. Consumers use it to decide whether to move DOM focus
 * and whether to scroll the cell into view:
 *  - `mouse` — a click/hover already placed focus; don't steal it back.
 *  - `select-all` — Ctrl+A moves the focus corner as bookkeeping only; never scroll or focus.
 *  - `drag-autoscroll` — a range drag's own rAF loop owns the scroll offset; a `scrollToIndex` here
 *    would snap the partially-visible edge row/column fully into view every frame and override it.
 */
export type GridInteractionSource = 'mouse' | 'keyboard' | 'select-all' | 'drag-autoscroll';

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
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Combined width of the sticky-left band. Every frozen column stacks at the left edge in column order
 * (`getFrozenLeftOffset`) whether or not the frozen columns are contiguous — the permission manager's
 * field table pins columns 1 and 2 while column 0 scrolls underneath them — so this sums all of them,
 * not just a leading run.
 */
function getFrozenBandWidth<TRow extends object>(table: TanstackTable<TRow>): number {
  return table.getVisibleLeafColumns().reduce((width, column) => (isFrozenColumn(column) ? width + column.getSize() : width), 0);
}

/**
 * Column indexes at which a row starts a (possibly multi-column) rendered cell — i.e. the navigable
 * positions for that row. Cells honor colSpan (GROUP for group headers, ROW for data rows), so a
 * spanned-over column has no DOM cell to focus; nav must step between, and snap onto, these owners.
 */
function getRowSegmentStarts<TRow extends object>(row: TanstackRow<TRow>, columns: TanstackColumn<TRow>[]): number[] {
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

/**
 * Column indexes at which the HEADER row starts a rendered header cell — honors HEADER colSpans
 * (column-group headers like the permission manager's profile name spanning its sub-columns), so
 * header navigation steps between rendered cells instead of walking every spanned-over track.
 */
function getHeaderSegmentStarts<TRow extends object>(columns: TanstackColumn<TRow>[]): number[] {
  const starts: number[] = [];
  let index = 0;
  while (index < columns.length) {
    starts.push(index);
    const span = Math.max(1, columns[index].columnDef.meta?.jetstream?.colSpan?.({ type: 'HEADER' }) ?? 1);
    index += span;
  }
  return starts;
}

/**
 * The header cell that OWNS `targetColIndex`: grouped headers span their sub-columns (only the span
 * owner renders a header cell), so a vertical move from a body cell in a spanned sub-column must land
 * on the owner or focus has no element to go to.
 */
function resolveHeaderColumnStart<TRow extends object>(columns: TanstackColumn<TRow>[], targetColIndex: number): number {
  let owner = 0;
  for (const start of getHeaderSegmentStarts(columns)) {
    if (start <= targetColIndex) {
      owner = start;
    } else {
      break;
    }
  }
  return owner;
}

/** Id of the header cell that owns `columnId` (see resolveHeaderColumnStart). */
function headerColumnIdFor<TRow extends object>(columns: TanstackColumn<TRow>[], columnId: string): string {
  const colIndex = Math.max(
    0,
    columns.findIndex((column) => column.id === columnId),
  );
  return columns[resolveHeaderColumnStart(columns, colIndex)]?.id ?? columnId;
}

/** The next/previous segment start relative to `colIndex` within `starts` (clamped at the ends). */
function stepSegment(starts: number[], colIndex: number, direction: 1 | -1): number {
  const segmentIndex = Math.max(0, starts.filter((start) => start <= colIndex).length - 1);
  return starts[clamp(segmentIndex + direction, 0, starts.length - 1)];
}

/**
 * True when the row renders at least one cell wider than a single column. Consumers use a row-level
 * colSpan for message/placeholder rows ("No metadata found", "no rows found") — the tell that a row
 * carries a rendered message rather than per-column data.
 */
function isSpannerRow<TRow extends object>(row: TanstackRow<TRow>, columns: TanstackColumn<TRow>[]): boolean {
  return getRowSegmentStarts(row, columns).length < columns.length;
}

/** The segment owner (start index) of the cell that covers `targetColIndex` in `row`. For a row with no
 * spans this is `targetColIndex` itself; for a spanned cell it's the column that renders it. */
function resolveColumnStart<TRow extends object>(row: TanstackRow<TRow>, columns: TanstackColumn<TRow>[], targetColIndex: number): number {
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

export interface UseGridKeyboardNavigationOptions<TRow extends object> {
  table: TanstackTable<TRow>;
  /** Returns the grid root element so DOM focus/copy queries are scoped to this grid instance. */
  getRootElement: () => HTMLElement | null;
  /** Returns the scroll container (`.jgrid-scroller`, owner of BOTH axes) that a range drag edge
   * auto-scrolls. Omit it and drags simply stop extending at the viewport edge, as they did before. */
  getScrollElement?: () => HTMLElement | null;
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
  mode: GridMode;
  setActiveCell: (cell: ActiveCell | null) => void;
  handleKeyDown: (event: ReactKeyboardEvent) => void;
  /** When the grid ROOT itself receives focus (Tab-in) and no cell is active, seed the first cell. Must
   * ignore focus bubbling up from descendants (header buttons, cells) or it would yank focus to (0,0). */
  handleRootFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  /** Whether the last active-cell change came from the mouse or keyboard — lets GridBody skip stealing
   * focus back to the cell on mouse clicks (which would close popovers opened from a cell). The
   * 'select-all' and 'drag-autoscroll' sources additionally suppress scroll-into-view. */
  getLastInteractionSource: () => GridInteractionSource;
  /** When focus leaves the grid entirely (e.g. Tab/Shift+Tab out), clear the active cell so the next
   * focus event re-seeds and the grid root re-enters the tab order. */
  handleRootBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  /** Mouse down on a cell — starts a (possibly shift-extended) selection / drag. Right-click keeps an
   * existing range when clicking inside it (spreadsheet behavior) so the context menu can act on it. */
  handleCellMouseDown: (rowId: string, columnId: string, shiftKey: boolean, button?: number, ctrlOrMetaKey?: boolean) => void;
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
export function useGridKeyboardNavigation<TRow extends object>({
  table,
  getRootElement,
  getScrollElement,
  onRequestEdit,
  shouldRetainFocusOnBlur,
  summaryRowCount = 0,
  onAnnounce,
  onUndo,
  onRedo,
  onClearSelection,
}: UseGridKeyboardNavigationOptions<TRow>): GridKeyboardNavigation {
  const [activeCell, setActiveCellState] = useState<ActiveCell | null>(null);
  const [mode, setMode] = useState<GridMode>('navigation');
  const isDraggingRef = useRef(false);
  // Tracks whether the most recent active-cell change was mouse- or keyboard-driven (see interface doc).
  const interactionSourceRef = useRef<GridInteractionSource>('keyboard');
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

  /** False for the select/action columns — they can never join a cell range (see buildColumnDefs). */
  const isColumnCellSelectable = useCallback(
    (columnId: string): boolean =>
      table.getVisibleLeafColumns().find((column) => column.id === columnId)?.columnDef.enableCellSelection !== false,
    [table],
  );

  /**
   * Whether a MOUSE drag may extend onto this column. Stricter than `isColumnCellSelectable`: a
   * sticky-left column that is currently covering scrolled-away content is not what the pointer is
   * reaching for — the user is dragging toward whatever sits underneath it. Extending there would
   * anchor the rectangle at the far-left column (selecting everything in between) and drag the
   * active-column scroll-into-view effect back to the start of the table with it. Once the grid is
   * scrolled home the band covers nothing, so its columns become ordinary drag targets again.
   */
  const isDragExtendTarget = useCallback(
    (columnId: string): boolean => {
      const column = table.getVisibleLeafColumns().find((candidate) => candidate.id === columnId);
      if (!column || column.columnDef.enableCellSelection === false) {
        return false;
      }
      return !isFrozenColumn(column) || (getScrollElement?.()?.scrollLeft ?? 0) === 0;
    },
    [table, getScrollElement],
  );

  // Apply a new active cell. `extend` grows the ACTIVE cell-selection range toward the target
  // (v9 keeps the range's anchor corner fixed); otherwise the selection collapses onto the new cell.
  // `keepDesiredCol` is set by vertical moves so they don't overwrite the user's sticky column with
  // the (possibly snapped) column they're passing through.
  const applySelection = useCallback(
    (rowId: string, columnId: string, extend: boolean, keepDesiredCol = false) => {
      const columns = table.getVisibleLeafColumns();
      if (!keepDesiredCol) {
        const colIndex = columns.findIndex((column) => column.id === columnId);
        if (colIndex >= 0) {
          desiredColRef.current = colIndex;
        }
      }
      setActiveCellState({ rowId, columnId });
      setMode('navigation');
      const columnSelectable = isColumnCellSelectable(columnId);
      // Cell selection (v9 state): an extend may sweep any ROW (group rows render nothing and copy
      // nothing, but the rectangle passes through them), never a non-selectable COLUMN. The select and
      // action columns are frozen at indexes 0/1, so letting Shift+Arrow anchor an edge there would snap
      // the rectangle to column 0 and swallow every column in between. Keyboard focus still moves onto
      // them so navigation can pass through; a MOUSE drag ignores them entirely (handleCellMouseEnter),
      // since moving the active cell there would drag the viewport back to column 0 with it.
      // A plain move participates only for body DATA cells on selectable columns; header/summary
      // sentinels, group header rows, and the select/action columns are focus-only and clear it.
      if (extend) {
        if (columnSelectable) {
          extendActiveSelectionTo(table, rowId, columnId);
        }
        return;
      }
      const isSentinel = rowId === HEADER_ROW_ID || isSummaryRowId(rowId);
      const row = isSentinel ? undefined : table.getRowModel().rows.find((candidate) => candidate.id === rowId);
      if (isSentinel || !columnSelectable || !row || row.getIsGrouped()) {
        clearCellSelection(table);
      } else {
        collapseSelectionTo(table, rowId, columnId);
      }
    },
    [table, isColumnCellSelectable],
  );

  // Edge auto-scroll: once the cursor leaves the scroll viewport there are no cells left to fire
  // `mouseenter`, so a drag would stop growing. This scrolls the container while the pointer sits at
  // (or beyond) an edge and extends the range to whatever cell scrolls under it.
  const rangeDragAutoScroll = useRangeDragAutoScroll({
    getScrollElement: getScrollElement ?? (() => null),
    getRootElement,
    getLeftInset: () => getFrozenBandWidth(table),
    getActiveCell: () => activeCellRef.current,
    onExtendToCell: (rowId, columnId) => {
      if (!isDragExtendTarget(columnId)) {
        return;
      }
      interactionSourceRef.current = 'drag-autoscroll';
      applySelection(rowId, columnId, true);
    },
    onDragEnd: () => {
      isDraggingRef.current = false;
    },
  });

  const beginRangeDrag = useCallback(() => {
    isDraggingRef.current = true;
    rangeDragAutoScroll.start();
  }, [rangeDragAutoScroll]);

  // Stop drag-select when the mouse is released anywhere.
  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
      rangeDragAutoScroll.stop();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [rangeDragAutoScroll]);

  const setActiveCell = useCallback(
    (cell: ActiveCell | null) => {
      interactionSourceRef.current = 'keyboard';
      if (cell) {
        applySelection(cell.rowId, cell.columnId, false);
      } else {
        setActiveCellState(null);
        clearCellSelection(table);
      }
    },
    [table, applySelection],
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
      const panel = Array.from(document.querySelectorAll<HTMLElement>('.slds-popover:not(.slds-popover_tooltip)')).find(
        (el) => !root || !el.contains(root),
      );
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
    // True while focus is inside an overlay (portaled popover/modal/dropdown menu) that is NOT an ancestor
    // of this grid — i.e. an overlay opened FROM the grid, excluding a modal that merely hosts the grid.
    // Focus-based on purpose: a document-wide query was permanently true in the app (the navbar's
    // CSS-toggled `.slds-dropdown` menus are always mounted, and any visible tooltip is a `.slds-popover`),
    // which silently disabled every return-focus path below.
    const hasForeignOverlayOpen = () => {
      const root = getRootElement();
      const active = document.activeElement;
      const overlay = active instanceof Element ? active.closest(GRID_OVERLAY_SELECTOR) : null;
      return !!overlay && (!root || !overlay.contains(root));
    };

    // Deferred a frame so an overlay close/unmount settles first; while the overlay is still up
    // (e.g. tabbing within it) the check is a no-op and the pending return stays armed.
    const scheduleReturnFocusCheck = () => {
      if (!pendingReturnFocusCellRef.current) {
        return;
      }
      requestAnimationFrame(() => {
        const cell = pendingReturnFocusCellRef.current;
        if (!cell) {
          return;
        }
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
        // ...unless that control is the cell's designated inner-focus widget, which IS the rover for that cell
        const focusReturnedToInnerFocusWidget = focusReturnedInsideCell && !!active?.closest('[data-grid-inner-focus]');
        if (!active || active === document.body || (focusReturnedInsideCell && !focusReturnedToInnerFocusWidget)) {
          if (cellEl) {
            // The overlay was opened from actionable mode in many cases; the cell is the rover again, so
            // navigation mode must be restored or Up/Down stay swallowed and the live region says "Actionable"
            setMode('navigation');
            cellEl.focus();
          } else {
            // The originating row is gone (the overlay's filter excluded it) — land on the header cell
            // of the same column so navigation continues from a live coordinate.
            interactionSourceRef.current = 'keyboard';
            applySelection(HEADER_ROW_ID, headerColumnIdFor(table.getVisibleLeafColumns(), cell.columnId), false);
          }
        }
      });
    };

    // When focus moves into such an overlay, remember the active cell so we can restore it on close.
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const overlay = target?.closest?.(GRID_OVERLAY_SELECTOR);
      const root = getRootElement();
      if (overlay && (!root || !overlay.contains(root)) && activeCellRef.current) {
        pendingReturnFocusCellRef.current = activeCellRef.current;
        return;
      }
      // Focus landed OUTSIDE any overlay while a return is armed. When an overlay unmounts with focus
      // still inside it, the browser fires no focusout for the removed node — the overlay's own
      // returnFocus then lands on the trigger and this focusin is the only close signal we get.
      scheduleReturnFocusCheck();
    };

    const handleFocusOut = () => {
      scheduleReturnFocusCheck();
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [applySelection, getCellElement, getRootElement, table]);

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
      if (!columns.length) {
        return;
      }
      interactionSourceRef.current = 'keyboard';
      if (rows.length) {
        applySelection(rows[0].id, columns[0].id, false);
      } else {
        // Empty body (e.g. a filter excluded every row): seed the header row instead — the column
        // filters are the only interactive surface left and must stay keyboard-reachable.
        applySelection(HEADER_ROW_ID, columns[0].id, false);
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
      clearCellSelection(table);
      setMode('navigation');
    },
    [shouldRetainFocusOnBlur, table],
  );

  /** True when the cell falls inside ANY selection rectangle (all ranges, exclusions applied). */
  const isCellInSelection = useCallback(
    (rowId: string, columnId: string): boolean => isCellInSelectionBounds(table, rowId, columnId),
    [table],
  );

  const handleCellMouseDown = useCallback(
    (rowId: string, columnId: string, shiftKey: boolean, button = 0, ctrlOrMetaKey = false) => {
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
        // Keep dragging after a shift-extend (Excel behavior): mouseenter continues growing the SAME
        // active range, since extend moves the focus corner while the anchor stays fixed.
        beginRangeDrag();
        return;
      }
      // Ctrl/Cmd+click on a selectable data cell starts a NEW rectangle that adds to (unselected cell)
      // or subtracts from (selected cell) the multi-range selection; a following drag grows it.
      const columnSelectable =
        table.getVisibleLeafColumns().find((column) => column.id === columnId)?.columnDef.enableCellSelection !== false;
      const targetRow = table.getRowModel().rows.find((candidate) => candidate.id === rowId);
      if (ctrlOrMetaKey && columnSelectable && targetRow && !targetRow.getIsGrouped()) {
        const colIndex = table.getVisibleLeafColumns().findIndex((column) => column.id === columnId);
        if (colIndex >= 0) {
          desiredColRef.current = colIndex;
        }
        setActiveCellState({ rowId, columnId });
        setMode('navigation');
        addOrExcludeCellRange(table, rowId, columnId);
        beginRangeDrag();
        return;
      }
      applySelection(rowId, columnId, false);
      beginRangeDrag();
    },
    [applySelection, beginRangeDrag, isCellInSelection, table],
  );

  const handleCellMouseEnter = useCallback(
    (rowId: string, columnId: string) => {
      if (!isDraggingRef.current || !isDragExtendTarget(columnId)) {
        return;
      }
      // Auto-scrolling re-fires `mouseenter` for hover changes the scroll itself caused. Ignoring the
      // ones that land back on the current focus corner keeps the source at 'drag-autoscroll' (so the
      // virtualizers' scroll-into-view stays suppressed) and avoids a render that changes nothing.
      const current = activeCellRef.current;
      if (current && current.rowId === rowId && current.columnId === columnId) {
        return;
      }
      interactionSourceRef.current = 'mouse';
      applySelection(rowId, columnId, true);
    },
    [applySelection, isDragExtendTarget],
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
      if (!rows.length || !columns.length) {
        return;
      }
      const boundsList = getSelectionBounds(table);
      if (!boundsList.length) {
        return;
      }

      // Build records keyed by synthetic field names (avoids dot-notation flattening on real column ids).
      // "With header" prepends the selected columns' display names as the first row (kept as data, keyed
      // by the same synthetic fields, so the dot-notation-safe copy path is reused unchanged). Synthetic
      // group header rows have no cell data — skipped so pasted output stays rectangular.
      const buildRegion = (rect: { minRowIndex: number; maxRowIndex: number; minColumnIndex: number; maxColumnIndex: number }) => {
        const fields: string[] = [];
        for (let colIndex = rect.minColumnIndex; colIndex <= rect.maxColumnIndex; colIndex++) {
          fields.push(`c${colIndex}`);
        }
        const records: Record<string, string>[] = [];
        if (includeHeader) {
          const headerRecord: Record<string, string> = {};
          for (let colIndex = rect.minColumnIndex; colIndex <= rect.maxColumnIndex; colIndex++) {
            headerRecord[`c${colIndex}`] = getColumnHeaderText(columns[colIndex]);
          }
          records.push(headerRecord);
        }
        for (let rowIndex = rect.minRowIndex; rowIndex <= rect.maxRowIndex; rowIndex++) {
          if (rows[rowIndex].getIsGrouped()) {
            continue;
          }
          const record: Record<string, string> = {};
          let hasText = false;
          for (let colIndex = rect.minColumnIndex; colIndex <= rect.maxColumnIndex; colIndex++) {
            const text = getCellText(rows[rowIndex], columns[colIndex]);
            hasText ||= text !== '';
            record[`c${colIndex}`] = text;
          }
          // Placeholder rows (deploy's "No metadata found" child) render a message through a row-level
          // colSpan and carry no cell values, so they'd land as a blank line mid-range. A genuinely
          // empty DATA row has no span and must still be copied — dropping it would shift every row
          // below it out of alignment with the source.
          if (!hasText && isSpannerRow(rows[rowIndex], columns)) {
            continue;
          }
          records.push(record);
        }
        return { fields, records };
      };

      if (boundsList.length === 1) {
        // Single rectangle: copyRecordsToClipboard writes BOTH text/html (a table) and an escaped
        // text/plain Excel string — pastes into Excel/Sheets as a proper grid.
        const rect = boundsList[0];
        const { fields, records } = buildRegion(rect);
        void copyRecordsToClipboard(records, 'excel', fields, false);
        flashCells(getRootElement(), rows, columns, rect.minRowIndex, rect.maxRowIndex, rect.minColumnIndex, rect.maxColumnIndex);
        const copiedRowCount = records.length - (includeHeader ? 1 : 0);
        const copiedColCount = fields.length;
        onAnnounce?.(
          `Copied ${copiedRowCount} ${copiedRowCount === 1 ? 'row' : 'rows'} by ${copiedColCount} ${
            copiedColCount === 1 ? 'column' : 'columns'
          }`,
        );
        return;
      }

      // Multiple disjoint rectangles: stack each region's Excel-escaped block separated by a blank line
      // (the convention spreadsheet apps handle most predictably for disjoint copies).
      let copiedCellCount = 0;
      const blocks = boundsList.map((rect) => {
        const { fields, records } = buildRegion(rect);
        copiedCellCount += (records.length - (includeHeader ? 1 : 0)) * fields.length;
        flashCells(getRootElement(), rows, columns, rect.minRowIndex, rect.maxRowIndex, rect.minColumnIndex, rect.maxColumnIndex);
        return transformTabularDataToExcelStr(records, fields);
      });
      void navigator.clipboard.writeText(blocks.join('\n\n')).catch(() => undefined);
      onAnnounce?.(`Copied ${copiedCellCount} cells across ${boundsList.length} ranges`);
    },
    [table, getRootElement, onAnnounce],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      // React synthetic events bubble through PORTALS following the React tree, so keys pressed
      // inside an overlay a cell renderer opened (record lookup popover) arrive here even though
      // the overlay's DOM lives outside the grid. Those keys belong to the overlay — handling them
      // as grid navigation re-activated the cell's control and toggle-closed the popover mid-press.
      const rootElement = getRootElement();
      if (rootElement && event.target instanceof Node && !rootElement.contains(event.target)) {
        return;
      }
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (!columns.length) {
        return;
      }
      interactionSourceRef.current = 'keyboard';

      // Null only while the body is empty — the empty-body branch below returns before it is used.
      const current: ActiveCell | null = activeCell ?? (rows.length ? { rowId: rows[0].id, columnId: columns[0].id } : null);
      const rowIndex = Math.max(
        0,
        rows.findIndex((row) => row.id === current?.rowId),
      );
      const colIndex = Math.max(
        0,
        columns.findIndex((column) => column.id === current?.columnId),
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
        // A text-entry control owns its arrow keys (caret movement) and Up/Down (textarea lines, select
        // options): from one of those only Tab/Shift+Tab cycle the cell's controls. Everything else is
        // left to the control, otherwise ArrowLeft in a summary-row filter input yanked focus back to the cell.
        const activeIsTextEntry =
          document.activeElement instanceof HTMLElement &&
          document.activeElement.matches(
            'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select, [contenteditable="true"]',
          );
        if (activeIsTextEntry && event.key !== 'Tab') {
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
          } else {
            // A lone control (e.g. a summary-row filter input) has nothing to cycle to — treat Tab
            // like Escape and return to the cell so focus stays inside the grid instead of exiting it.
            consume();
            setMode('navigation');
            cellEl?.focus();
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
          // Header cells honor HEADER colSpans (e.g. a profile-name group header spanning its
          // Read/Edit sub-columns) — arrows step between RENDERED cells, not underlying tracks,
          // otherwise a spanned header needs one press per covered column to cross.
          case 'ArrowRight':
            consume();
            applySelection(HEADER_ROW_ID, columns[stepSegment(getHeaderSegmentStarts(columns), headerColIndex, 1)].id, false);
            break;
          case 'ArrowLeft':
            consume();
            applySelection(HEADER_ROW_ID, columns[stepSegment(getHeaderSegmentStarts(columns), headerColIndex, -1)].id, false);
            break;
          case 'Home':
            consume();
            applySelection(HEADER_ROW_ID, columns[0].id, false);
            break;
          case 'End': {
            consume();
            const headerStarts = getHeaderSegmentStarts(columns);
            applySelection(HEADER_ROW_ID, columns[headerStarts[headerStarts.length - 1]].id, false);
            break;
          }
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
              applySelection(HEADER_ROW_ID, headerColumnIdFor(columns, columns[summaryColIndex].id), false, true);
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

      // ── Empty body (a filter excluded every row, or no data has loaded) ──
      // The header and summary rows are the only live surface left — route navigation keys there so
      // the column filters stay reachable and the user can broaden the filter again. Without this the
      // grid went completely dead (every key returned early) the moment a filter matched zero rows.
      if (!rows.length || !current) {
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowDown':
          case 'ArrowLeft':
          case 'ArrowRight':
          case 'Home':
          case 'End':
          case 'PageUp':
          case 'PageDown': {
            consume();
            // Keep the column when the active cell references a row the filter just removed.
            const columnId = current && columns.some((column) => column.id === current.columnId) ? current.columnId : columns[0].id;
            applySelection(
              summaryRowCount > 0 ? getSummaryRowId(summaryRowCount - 1) : HEADER_ROW_ID,
              summaryRowCount > 0 ? columnId : headerColumnIdFor(columns, columnId),
              false,
            );
            break;
          }
          default:
            break;
        }
        return;
      }

      // A cell marked for inner-widget focus (data-grid-inner-focus) keeps NATIVE activation: focus
      // sits on the widget itself, so Enter/Space fire its click through the browser — the grid must
      // neither consume the key (that would block the native click) nor also activate the cell
      // (that would double-fire the action).
      if ((event.key === 'Enter' || event.key === ' ') && !ctrlOrMeta && event.target instanceof HTMLElement) {
        const innerFocusControl = event.target.closest('[data-grid-inner-focus]');
        if (innerFocusControl) {
          // A focusable-but-not-activatable target (a tooltip trigger span) has no native Space action, so
          // the browser would scroll the virtualized body — swallow it (the target's own keydown ran first).
          const nativelyActivatable = innerFocusControl.matches('button, a[href], input, select, textarea, summary');
          if (!nativelyActivatable) {
            if (event.key === ' ') {
              consume();
            }
            return;
          }
          // Space activates every control natively; Enter is native for buttons/links but a NO-OP on
          // checkboxes — for those, fall through so the grid's activate path clicks the checkbox.
          const enterIsNative = !(innerFocusControl instanceof HTMLInputElement && innerFocusControl.type === 'checkbox');
          if (event.key === ' ' || enterIsNative) {
            return;
          }
        }
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
            applySelection(
              summaryRowCount > 0 ? getSummaryRowId(summaryRowCount - 1) : HEADER_ROW_ID,
              summaryRowCount > 0 ? columns[desiredCol].id : headerColumnIdFor(columns, columns[desiredCol].id),
              false,
              true,
            );
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
            // Segment-aware: from a cell that spans several columns (e.g. a full-width message row),
            // +1 lands inside the same span and snaps back to its owner — step to the next rendered
            // cell instead. Rows without spans get plain +1 (every column is a segment start).
            moveTo(rowIndex, currentRow ? stepSegment(getRowSegmentStarts(currentRow, columns), colIndex, 1) : colIndex + 1, extend);
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
            moveTo(rowIndex, currentRow ? stepSegment(getRowSegmentStarts(currentRow, columns), colIndex, -1) : colIndex - 1, extend);
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
            table.selectAllCells();
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
        case 'Escape':
          // With a multi-cell selection, Escape collapses it to the active cell (and is consumed so it
          // can't also close a hosting modal); with nothing to collapse it bubbles as before.
          if (activeCell && hasMultiCellSelection(getSelectionBounds(table))) {
            consume();
            applySelection(activeCell.rowId, activeCell.columnId, false);
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
      getRootElement,
    ],
  );

  return {
    activeCell,
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

function flashCells<TRow extends object>(
  root: HTMLElement | null,
  rows: TanstackRow<TRow>[],
  columns: TanstackColumn<TRow>[],
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
