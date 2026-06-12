/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import type { Column, Row, Table } from '@tanstack/react-table';
import { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ActiveCell } from '../components/GridRow';

export type GridMode = 'navigation' | 'actionable';

/** Rows to jump on PageUp/PageDown (approximate viewport page). */
const PAGE_SIZE = 12;

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

      // ── Actionable mode: only Escape is handled here; everything else is the cell's own behavior. ──
      if (mode === 'actionable') {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setMode('navigation');
        }
        return;
      }

      // ── Navigation mode ──
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveTo(rowIndex + 1, colIndex, extend);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveTo(rowIndex - 1, colIndex, extend);
          break;
        case 'ArrowRight': {
          event.preventDefault();
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
          event.preventDefault();
          const currentRow = rows[rowIndex];
          // Tree: Left collapses an expanded row, else moves to its parent row, else moves left.
          if (!extend && currentRow?.getCanExpand() && currentRow.getIsExpanded()) {
            currentRow.toggleExpanded();
          } else if (!extend && currentRow && currentRow.depth > 0) {
            const parent = currentRow.getParentRow();
            const parentIndex = parent ? rows.findIndex((row) => row.id === parent.id) : -1;
            moveTo(parentIndex >= 0 ? parentIndex : rowIndex, parentIndex >= 0 ? colIndex : colIndex - 1, extend);
          } else {
            moveTo(rowIndex, colIndex - 1, extend);
          }
          break;
        }
        case 'Home':
          event.preventDefault();
          moveTo(ctrlOrMeta ? 0 : rowIndex, 0, extend);
          break;
        case 'End':
          event.preventDefault();
          moveTo(ctrlOrMeta ? rows.length - 1 : rowIndex, columns.length - 1, extend);
          break;
        case 'PageDown':
          event.preventDefault();
          moveTo(rowIndex + PAGE_SIZE, colIndex, extend);
          break;
        case 'PageUp':
          event.preventDefault();
          moveTo(rowIndex - PAGE_SIZE, colIndex, extend);
          break;
        case 'a':
        case 'A':
          if (ctrlOrMeta) {
            event.preventDefault();
            // 'select-all' suppresses scroll-into-view/focus of the new active corner — selecting
            // everything must not jump the viewport to the bottom-right of the grid.
            interactionSourceRef.current = 'select-all';
            setActiveCellState({ rowId: rows[rows.length - 1].id, columnId: columns[columns.length - 1].id });
            setAnchorCell({ rowId: rows[0].id, columnId: columns[0].id });
          }
          break;
        case 'Enter':
        case 'F2':
          event.preventDefault();
          applySelection(current.rowId, current.columnId, false);
          // Editable cells open their editor; everything else enters Actionable mode.
          if (!(onRequestEdit && onRequestEdit(current))) {
            setMode('actionable');
          }
          break;
        case 'c':
        case 'C':
          if (ctrlOrMeta) {
            copySelection();
          }
          break;
        default:
          break;
      }
    },
    [activeCell, mode, table, moveTo, applySelection, copySelection, onRequestEdit],
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
