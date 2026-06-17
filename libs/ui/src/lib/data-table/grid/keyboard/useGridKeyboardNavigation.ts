/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import type { Column, Row, Table } from '@tanstack/react-table';
import { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ActiveCell } from '../components/GridRow';
import { HEADER_ROW_ID } from '../grid-constants';

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
  /** Copy the current selection (rectangle, or the single active cell) as TSV. */
  copySelection: () => void;
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
  activeCellRef.current = activeCell;

  // Stop drag-select when the mouse is released anywhere.
  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Apply a new active cell. `extend` keeps the existing anchor (range select); otherwise the anchor
  // collapses onto the new cell.
  const applySelection = useCallback((rowId: string, columnId: string, extend: boolean) => {
    setActiveCellState({ rowId, columnId });
    setMode('navigation');
    setAnchorCell((prevAnchor) => (extend && prevAnchor ? prevAnchor : { rowId, columnId }));
  }, []);

  const setActiveCell = useCallback((cell: ActiveCell | null) => {
    interactionSourceRef.current = 'keyboard';
    setActiveCellState(cell);
    setAnchorCell(cell);
  }, []);

  const moveTo = useCallback(
    (rowIndex: number, colIndex: number, extend: boolean) => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      if (!rows.length || !columns.length) {
        return;
      }
      const nextRow = rows[clamp(rowIndex, 0, rows.length - 1)];
      // Group header rows are navigated at the row level — snap focus to the first column.
      const nextColIndex = nextRow.getIsGrouped() ? 0 : clamp(colIndex, 0, columns.length - 1);
      applySelection(nextRow.id, columns[nextColIndex].id, extend);
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
        const active = document.activeElement;
        if (!active || active === document.body) {
          getCellElement(cell)?.focus();
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
      if (shiftKey) {
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

  const copySelection = useCallback(() => {
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
  }, [activeCell, anchorCell, table, getRootElement]);

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
          case 'Escape':
            consume();
            // Back to the body (moveTo handles group-row column snapping).
            moveTo(0, headerColIndex, false);
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

      // ── Navigation mode ──
      switch (event.key) {
        case 'ArrowDown':
          consume();
          moveTo(rowIndex + 1, colIndex, extend);
          break;
        case 'ArrowUp':
          consume();
          // From the first body row, Up enters the column header row (so the keyboard can reach
          // select-all / header filters). A range-extend (Shift) stays in the body.
          if (rowIndex === 0 && !extend) {
            applySelection(HEADER_ROW_ID, columns[colIndex].id, false);
          } else {
            moveTo(rowIndex - 1, colIndex, extend);
          }
          break;
        case 'ArrowRight': {
          consume();
          const currentRow = rows[rowIndex];
          // Tree: Right expands a collapsed expandable row; otherwise move to the next cell.
          if (!extend && currentRow?.getCanExpand() && !currentRow.getIsExpanded()) {
            currentRow.toggleExpanded();
          } else {
            moveTo(rowIndex, colIndex + 1, extend);
          }
          break;
        }
        case 'ArrowLeft': {
          consume();
          const currentRow = rows[rowIndex];
          // The tree/grouping behaviors only apply at the first column — otherwise Left just moves one
          // cell left. Without the `colIndex === 0` guard, a grouped sub-row (depth>0, parent = group
          // header) snaps Left to the group row from any column instead of moving left.
          if (colIndex === 0 && !extend && currentRow?.getCanExpand() && currentRow.getIsExpanded()) {
            // Collapse an expanded tree/group row.
            currentRow.toggleExpanded();
          } else if (colIndex === 0 && !extend && currentRow && currentRow.depth > 0) {
            // Jump from a nested/grouped row to its parent (group header) row.
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
          moveTo(rowIndex + PAGE_SIZE, colIndex, extend);
          break;
        case 'PageUp':
          consume();
          moveTo(rowIndex - PAGE_SIZE, colIndex, extend);
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
          // open a popover), falling back to Actionable mode for multi-control cells.
          if (!(onRequestEdit && onRequestEdit(current))) {
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
        default:
          break;
      }
    },
    [activeCell, mode, table, moveTo, applySelection, copySelection, onRequestEdit, activateCell, activateHeaderCell, getCellElement],
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
