import type { CellSelectionBounds, CellSelectionState } from '@tanstack/react-table';
import { TanstackTable } from '../grid-types';

/**
 * Facade over v9's `cellSelectionFeature` — every grid read/write of the `cellSelection` slice goes
 * through here so the (young) upstream API surface is confined to one module.
 *
 * Model recap: `CellSelectionState` is an ordered list of `{anchor, focus, operation}` ranges keyed by
 * ROW/COLUMN IDS (they survive sort/filter/reorder); the LAST entry is the active range that
 * shift-extend and drag mutate. `table.getCellSelectionBounds()` resolves the include/exclude algebra
 * into disjoint, inclusive DISPLAY-INDEX rectangles (ranges with unresolvable corners are omitted, not
 * clamped). Jetstream renders and copies from bounds; it writes state via the helpers below.
 *
 * Jetstream keeps its own event wiring and keyboard model (sentinel header/summary rows, colSpan
 * snapping, select-column carve-out) and drives these imperative APIs — v9's own DOM handlers are
 * never bound.
 */

/** Inclusive column span of a selection rectangle intersecting one display row. */
export interface RowSelectionSpan {
  startCol: number;
  endCol: number;
  /** This row is the rectangle's top edge. */
  top: boolean;
  /** This row is the rectangle's bottom edge. */
  bottom: boolean;
}

/** Collapse the entire selection to a single cell (the normal plain-click/arrow-move behavior). */
export function collapseSelectionTo<TRow extends object>(table: TanstackTable<TRow>, rowId: string, columnId: string): void {
  table.setFocusedCell(rowId, columnId);
}

/** Extend the ACTIVE (last) range's focus corner — shift-click / shift-arrow / drag-over behavior.
 * Starts a fresh single-cell range when nothing is selected yet. */
export function extendActiveSelectionTo<TRow extends object>(table: TanstackTable<TRow>, rowId: string, columnId: string): void {
  table.setCellSelection((previous: CellSelectionState) => {
    if (!previous.length) {
      return [{ anchorRowId: rowId, anchorColumnId: columnId, focusRowId: rowId, focusColumnId: columnId }];
    }
    const active = previous[previous.length - 1];
    if (active.focusRowId === rowId && active.focusColumnId === columnId) {
      return previous;
    }
    return [...previous.slice(0, -1), { ...active, focusRowId: rowId, focusColumnId: columnId }];
  });
}

/** Ctrl/Cmd+click: start a new rectangle that ADDS to the selection when the cell is unselected, or
 * SUBTRACTS when it is already selected (spreadsheet multi-range semantics). The new range becomes the
 * active one, so a following drag/shift-extend grows it. */
export function addOrExcludeCellRange<TRow extends object>(table: TanstackTable<TRow>, rowId: string, columnId: string): void {
  const mode = isCellInSelectionBounds(table, rowId, columnId) ? 'exclude' : 'include';
  table.selectCellRange({ anchorRowId: rowId, anchorColumnId: columnId, focusRowId: rowId, focusColumnId: columnId }, { mode });
}

export function clearCellSelection<TRow extends object>(table: TanstackTable<TRow>): void {
  table.setCellSelection((previous: CellSelectionState) => (previous.length ? [] : previous));
}

export function getSelectionBounds<TRow extends object>(table: TanstackTable<TRow>): CellSelectionBounds[] {
  return table.getCellSelectionBounds();
}

/** True when the selection covers more than one cell (drives context-menu gating + Escape-collapse). */
export function hasMultiCellSelection(bounds: CellSelectionBounds[]): boolean {
  if (bounds.length > 1) {
    return true;
  }
  const only = bounds[0];
  return !!only && (only.minRowIndex !== only.maxRowIndex || only.minColumnIndex !== only.maxColumnIndex);
}

/** Display-index membership test against the resolved bounds (covers all ranges + exclusions). */
export function isCellInSelectionBounds<TRow extends object>(table: TanstackTable<TRow>, rowId: string, columnId: string): boolean {
  const rowIndex = table.getRowModel().rows.findIndex((row) => row.id === rowId);
  const colIndex = table.getVisibleLeafColumns().findIndex((column) => column.id === columnId);
  if (rowIndex < 0 || colIndex < 0) {
    return false;
  }
  return table
    .getCellSelectionBounds()
    .some(
      (bounds) =>
        rowIndex >= bounds.minRowIndex &&
        rowIndex <= bounds.maxRowIndex &&
        colIndex >= bounds.minColumnIndex &&
        colIndex <= bounds.maxColumnIndex,
    );
}

/** The ACTIVE (last) range resolved to an inclusive display-index rectangle, or null when empty /
 * unresolvable. Paste and clear-selection target this rectangle (Excel parity: pasting into disjoint
 * ranges is ambiguous, so only the active one receives it). */
export function getActiveRangeRect<TRow extends object>(
  table: TanstackTable<TRow>,
): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
  const selection = table.store.state.cellSelection;
  const active = selection[selection.length - 1];
  if (!active) {
    return null;
  }
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();
  const anchorRow = rows.findIndex((row) => row.id === active.anchorRowId);
  const focusRow = rows.findIndex((row) => row.id === active.focusRowId);
  const anchorCol = columns.findIndex((column) => column.id === active.anchorColumnId);
  const focusCol = columns.findIndex((column) => column.id === active.focusColumnId);
  if (anchorRow < 0 || focusRow < 0 || anchorCol < 0 || focusCol < 0) {
    return null;
  }
  return {
    minRow: Math.min(anchorRow, focusRow),
    maxRow: Math.max(anchorRow, focusRow),
    minCol: Math.min(anchorCol, focusCol),
    maxCol: Math.max(anchorCol, focusCol),
  };
}

// Per-row span lookup, identity-cached on the bounds array so a GridRow whose spans didn't change
// keeps prop equality (bounds identity changes on every selection change; rows outside every
// rectangle all share the null result).
const spanCache = new WeakMap<CellSelectionBounds[], Map<number, RowSelectionSpan[] | null>>();

/** The selection rectangles intersecting one display row, as inclusive column spans (null when none).
 * Sorted by start column; adjacent rectangles are NOT merged (their vertical edges must both render). */
export function getRowSelectionSpans(bounds: CellSelectionBounds[], rowIndex: number): RowSelectionSpan[] | null {
  let byRow = spanCache.get(bounds);
  if (!byRow) {
    byRow = new Map();
    spanCache.set(bounds, byRow);
  }
  if (byRow.has(rowIndex)) {
    return byRow.get(rowIndex) ?? null;
  }
  let spans: RowSelectionSpan[] | null = null;
  for (const rect of bounds) {
    if (rowIndex < rect.minRowIndex || rowIndex > rect.maxRowIndex) {
      continue;
    }
    spans ??= [];
    spans.push({
      startCol: rect.minColumnIndex,
      endCol: rect.maxColumnIndex,
      top: rowIndex === rect.minRowIndex,
      bottom: rowIndex === rect.maxRowIndex,
    });
  }
  spans?.sort((a, b) => a.startCol - b.startCol);
  byRow.set(rowIndex, spans);
  return spans;
}

/** Selection bitmask for one cell, or 0 when the cell is not selected. Bit 16 is ALWAYS set for a
 * selected cell (the fill), so `result !== 0` ⇔ "selected"; bits 1 (top), 2 (right), 4 (bottom) and
 * 8 (left) mark which selection-rectangle edges the cell sits on and may all be absent for an
 * interior cell. Derived from the row's spans so GridCell props stay primitive. */
export function getCellRangeEdges(spans: RowSelectionSpan[] | null, colIndex: number): number {
  if (!spans) {
    return 0;
  }
  for (const span of spans) {
    if (colIndex < span.startCol || colIndex > span.endCol) {
      continue;
    }
    let edges = 16; // bit 16 = selected (fill), even when no border edge touches this cell
    if (span.top) {
      edges |= 1;
    }
    if (colIndex === span.endCol) {
      edges |= 2;
    }
    if (span.bottom) {
      edges |= 4;
    }
    if (colIndex === span.startCol) {
      edges |= 8;
    }
    return edges;
  }
  return 0;
}
