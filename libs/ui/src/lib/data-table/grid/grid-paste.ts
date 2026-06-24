import type { Column, Row } from '@tanstack/react-table';
import { parse as parseCsv } from 'papaparse';
import { PasteEvent, PasteTargetCell } from './grid-types';

/**
 * Generic, consumer-agnostic clipboard-paste helpers — the paste counterpart to `grid-clipboard.ts`.
 * The grid computes which editable cells a paste lands on (selection geometry + parsed clipboard matrix);
 * the consumer owns value coercion + dirty tracking via the `onPaste` callback.
 */

export interface PasteSelectionRect {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/**
 * Parse clipboard text (TSV from Excel/Sheets or our own copy) into a rectangular, padded string matrix.
 * A single value (no tab/newline) short-circuits to a 1x1 matrix so quoting heuristics never apply.
 */
export function parsePastedText(text: string): string[][] {
  if (text == null || text === '') {
    return [];
  }
  if (!text.includes('\t') && !text.includes('\n') && !text.includes('\r')) {
    return [[text]];
  }

  const result = parseCsv<string[]>(text, { delimiter: '\t', skipEmptyLines: false, header: false });
  let rows = (result.data || []).map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []));

  // Excel/Sheets append a trailing newline → a final empty row. Drop ONE trailing all-empty row so it
  // doesn't blank out a real row, but keep intentional interior blanks.
  if (rows.length > 1) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 0 || lastRow.every((cell) => cell === '')) {
      rows = rows.slice(0, -1);
    }
  }

  // Pad ragged rows to a uniform column count so the tiling index math is always in-bounds.
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    const padded = row.slice();
    while (padded.length < colCount) {
      padded.push('');
    }
    return padded;
  });
}

export interface ComputePasteTargetsParams<TRow> {
  /** Display-ordered data rows (`table.getRowModel().rows`). */
  rows: Row<TRow>[];
  /** Visible leaf columns (`table.getVisibleLeafColumns()`); `column.id` is the author key. */
  columns: Column<TRow, unknown>[];
  /** The active selection rectangle (collapse a single cell to min===max). */
  selRect: PasteSelectionRect;
  matrix: string[][];
  /** Canonical editability predicate (read-only / relationship / action+select columns return false). */
  isColumnEditable: (rowId: string, columnId: string) => boolean;
  getRowKey: (row: TRow) => string;
}

/**
 * Resolve the editable target cells for a paste. One unified formula —
 * `value = matrix[(r-minRow) % R][(c-minCol) % C]` — covers all three modes:
 *  - single value (R=C=1) → fills the whole selection,
 *  - block into a collapsed selection → tiles the block from the anchor,
 *  - block into a larger selection → tiles to fill it.
 * Everything is clipped to the grid bounds (this grid never adds rows), and grouped/non-editable cells
 * are skipped (the latter counted so the caller can announce how many read-only cells were ignored).
 */
export function computePasteTargets<TRow>({
  rows,
  columns,
  selRect,
  matrix,
  isColumnEditable,
  getRowKey,
}: ComputePasteTargetsParams<TRow>): PasteEvent {
  const cells: PasteTargetCell[] = [];
  let skippedCount = 0;

  const matrixRowCount = matrix.length;
  const matrixColCount = matrixRowCount ? matrix[0].length : 0;
  if (!matrixRowCount || !matrixColCount) {
    return { cells, skippedCount };
  }

  const isCollapsed = selRect.minRow === selRect.maxRow && selRect.minCol === selRect.maxCol;
  const endRow = isCollapsed ? selRect.minRow + matrixRowCount - 1 : selRect.maxRow;
  const endCol = isCollapsed ? selRect.minCol + matrixColCount - 1 : selRect.maxCol;
  const lastRow = rows.length - 1;
  const lastCol = columns.length - 1;

  for (let rowIndex = selRect.minRow; rowIndex <= Math.min(endRow, lastRow); rowIndex++) {
    const row = rows[rowIndex];
    // Synthetic group/aggregate rows have no editable data cells — skip silently (not "read-only").
    if (!row || row.getIsGrouped?.()) {
      continue;
    }
    for (let colIndex = selRect.minCol; colIndex <= Math.min(endCol, lastCol); colIndex++) {
      const column = columns[colIndex];
      if (!column) {
        continue;
      }
      const value = matrix[(rowIndex - selRect.minRow) % matrixRowCount][(colIndex - selRect.minCol) % matrixColCount];
      if (!isColumnEditable(row.id, column.id)) {
        skippedCount++;
        continue;
      }
      cells.push({ rowKey: getRowKey(row.original), columnKey: column.id, value });
    }
  }

  return { cells, skippedCount };
}

/**
 * Briefly flash the cells that received a pasted value. Walks the mounted (virtualized) cells once and
 * tests membership — never querySelector per cell — mirroring `flashCells` in the keyboard hook.
 * `cellKeys` holds `${rowId}::${columnId}` pairs (rowId === getRowKey, columnId === author key).
 */
export function flashPastedCells(root: HTMLElement | null, cellKeys: Set<string>): void {
  if (!root || !cellKeys.size) {
    return;
  }
  const flashed: Element[] = [];
  root.querySelectorAll('[data-row-id][data-col-id]').forEach((cellEl) => {
    const rowId = cellEl.getAttribute('data-row-id');
    const colId = cellEl.getAttribute('data-col-id');
    if (rowId && colId && cellKeys.has(`${rowId}::${colId}`)) {
      cellEl.classList.add('pasted');
      flashed.push(cellEl);
    }
  });
  setTimeout(() => flashed.forEach((cellEl) => cellEl.classList.remove('pasted')), 600);
}
