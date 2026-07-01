/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CSSProperties, RefObject, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_ROW_HEIGHT, HEADER_ROW_ID, isSummaryRowId } from '../grid-constants';
import { GridMode, SelectionRange } from '../keyboard/useGridKeyboardNavigation';
import { GridGroupRow } from './GridGroupRow';
import { ActiveCell, GridRow } from './GridRow';

/** `columnWidths` is a live `columnId → resolved pixel width` map so a height that depends on a column's
 * width (e.g. estimating wrapped-text lines) tracks user resizes. */
export type RowHeightFn<TRow> = (args: { type: 'ROW' | 'GROUP'; row: TRow; columnWidths: Record<string, number> }) => number;

export interface GridBodyProps<TRow> {
  table: Table<TRow>;
  /** Scroll element that owns vertical scrolling (the virtualizer measures against it). */
  scrollRef: RefObject<HTMLDivElement | null>;
  gridTemplateColumns: string;
  /** Visible leaf-column indexes to render (windowed + always-on frozen), passed through to each row. */
  visibleColumnIndexes: number[];
  /** Fixed numeric height per row, or a per-row callback. This is the authoritative, deterministic row
   * height — each row's box is pinned to it. Rows are NOT DOM-measured: with column virtualization the
   * mounted-cell set changes during horizontal scroll, so a measured height would oscillate and reflow
   * the whole body. A callback returning data-driven heights (e.g. by content length) is the way to size
   * variable rows. */
  rowHeight?: number | RowHeightFn<TRow>;
  overscan?: number;
  /** Number of pinned summary rows rendered above the body (in the sticky header block). Body rows
   * offset their `aria-rowindex` past these so the grid's row numbering stays continuous and unique. */
  summaryRowCount?: number;
  activeCell?: ActiveCell | null;
  mode?: GridMode;
  /** Whether the active cell last changed via mouse vs keyboard — on mouse we skip auto-focusing the
   * cell so popovers/controls opened by the click keep focus; on 'select-all' we additionally skip
   * scroll-into-view (Ctrl+A must not jump the viewport to the last row). */
  getLastInteractionSource?: () => 'mouse' | 'keyboard' | 'select-all';
  /** The cell currently being edited (its editor owns focus, so the body must not steal it). */
  editingCell?: ActiveCell | null;
  /** Rectangular cell selection (display-index bounds), or null when collapsed to one cell. */
  selectionRange?: SelectionRange | null;
  onCellMouseDown?: (rowId: string, columnId: string, shiftKey: boolean, button?: number) => void;
  onCellMouseEnter?: (rowId: string, columnId: string) => void;
  onCellContextMenu?: (event: React.MouseEvent, rowId: string, columnId: string) => void;
  rowClass?: (row: TRow) => string | undefined;
  onStartEdit?: (rowId: string, columnId: string) => void;
  onCommitRow?: (updatedRow: TRow, rowId: string, columnId: string) => void;
  /** When true, rows size to their content (cells wrap) and are DOM-measured by the virtualizer instead of
   * pinned to `rowHeight`. The caller must also render every column (no horizontal virtualization) so a
   * row's measured height reflects all its cells — `GridContainer` does this when `autoRowHeight` is set. */
  autoRowHeight?: boolean;
}

// In-cell controls are removed from the page tab order (tabindex="-1") so the grid is a single tab stop.
// Entering actionable mode must still focus the first one, so this selector intentionally INCLUDES
// `tabindex="-1"` controls. `[aria-haspopup]` matches floating-ui popover triggers.
const ACTIONABLE_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [aria-haspopup]';

/**
 * Owns the row virtualizer (deepest-component rule: instantiating it here keeps the measurement cache
 * and scroll position stable when upstream sort/filter state changes). Also resolves the keyboard
 * navigation's logical active-cell coordinate to a DOM element — scrolling it into view and focusing
 * it (retrying across a few frames while the virtualizer mounts the target row).
 */
export function GridBody<TRow>({
  table,
  scrollRef,
  gridTemplateColumns,
  visibleColumnIndexes,
  rowHeight,
  overscan = 8,
  summaryRowCount = 0,
  activeCell,
  mode = 'navigation',
  getLastInteractionSource,
  editingCell,
  selectionRange,
  onCellMouseDown,
  onCellMouseEnter,
  onCellContextMenu,
  rowClass,
  onStartEdit,
  onCommitRow,
  autoRowHeight,
}: GridBodyProps<TRow>) {
  const { rows } = table.getRowModel();
  const leafColumns = table.getVisibleLeafColumns();

  // Hold rowHeight in a ref so the virtualizer's estimateSize closure always reads the latest function
  // (and the virtualizer's identity stays stable across renders).
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;

  // Live `columnId → resolved width` map handed to a rowHeight callback so width-dependent heights track
  // resizes. Read from `columnSizing` so it recomputes when a resize commits (columnResizeMode 'onEnd');
  // held in a ref so the stable estimateSize closure reads the latest without re-creating the virtualizer.
  const columnSizing = table.getState().columnSizing;
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    leafColumns.forEach((column) => {
      widths[column.id] = column.getSize();
    });
    return widths;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafColumns, columnSizing]);
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const current = rowHeightRef.current;
      if (typeof current === 'function') {
        const row = rows[index];
        if (row) {
          return current({ type: row.getIsGrouped() ? 'GROUP' : 'ROW', row: row.original, columnWidths: columnWidthsRef.current });
        }
        return DEFAULT_ROW_HEIGHT;
      }
      return current ?? DEFAULT_ROW_HEIGHT;
    },
    overscan,
    getItemKey: (index) => rows[index].id,
    // In auto-height mode the estimate above is only the initial guess; the virtualizer measures each
    // rendered row's real height (rows wrap to content) and corrects the offsets, keeping virtualization.
    ...(autoRowHeight ? { measureElement: (el: Element | null) => el?.getBoundingClientRect().height ?? DEFAULT_ROW_HEIGHT } : {}),
  });
  const measureRowRef = autoRowHeight ? rowVirtualizer.measureElement : undefined;

  // Resolve the active cell to a DOM node: scroll its row into view, then focus the cell (navigation)
  // or the first focusable inside it (actionable). Runs only when the coordinate/mode changes — NOT on
  // manual scroll — so scrolling away from the active cell never yanks the viewport back.
  // True when the active cell is the one being edited — its editor input owns focus, so skip cell focus.
  const isEditingActiveCell =
    !!editingCell && !!activeCell && editingCell.rowId === activeCell.rowId && editingCell.columnId === activeCell.columnId;

  useEffect(() => {
    if (!activeCell) {
      return;
    }
    // Select-all moves the active corner to the last cell purely as selection bookkeeping — never
    // scroll or move focus for it.
    if (getLastInteractionSource?.() === 'select-all') {
      return;
    }
    // The column header and pinned summary rows are virtual rows in the sticky header block (always
    // mounted) — they have no body-row index to scroll to, but still resolve to a DOM cell below for focus.
    const isHeaderOrSummary = activeCell.rowId === HEADER_ROW_ID || isSummaryRowId(activeCell.rowId);
    if (!isHeaderOrSummary) {
      const rowIndex = rows.findIndex((row) => row.id === activeCell.rowId);
      if (rowIndex < 0) {
        return;
      }
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }

    // The editor owns focus while editing; don't yank it to the cell. (When editing ends this effect
    // re-runs with isEditingActiveCell=false and restores focus to the cell.)
    if (isEditingActiveCell) {
      return;
    }

    // A mouse click already placed focus correctly — on the cell, or on an interactive control / portaled
    // popover rendered inside it. Re-focusing the cell here would steal focus back and close those
    // popovers, so only keyboard / programmatic activation drives cell focus.
    if (getLastInteractionSource?.() === 'mouse') {
      return;
    }

    let attempts = 0;
    // A captured cancel flag (vs cancelling only the last scheduled frame) terminates the retry chain
    // even if effect cleanup fires between rAF dispatch and the next tryFocus call. Without this, rapid
    // arrow-key navigation can leave a stale focus chain racing the new effect's focus target.
    let cancelled = false;
    const tryFocus = () => {
      if (cancelled) {
        return;
      }
      const cellEl = scrollRef.current?.querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(activeCell.rowId)}"][data-col-id="${CSS.escape(activeCell.columnId)}"]`,
      );
      if (cellEl) {
        if (mode === 'actionable') {
          // Move focus to the first interactive control. The cell DIV holding focus (the navigation-mode
          // state) must NOT count as "already inside" — otherwise entering actionable mode from the cell
          // would leave focus on the div, and Space/arrows would scroll the page instead of driving the
          // control. Only skip when a control inside the cell already has focus.
          const focusable = cellEl.querySelector<HTMLElement>(ACTIONABLE_FOCUSABLE_SELECTOR);
          const controlAlreadyFocused = document.activeElement !== cellEl && cellEl.contains(document.activeElement);
          if (!controlAlreadyFocused) {
            (focusable ?? cellEl).focus();
          }
        } else if (!cellEl.contains(document.activeElement)) {
          cellEl.focus();
        }
        return;
      }
      if (attempts++ < 6) {
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell, mode, isEditingActiveCell]);

  // Rows are pinned to deterministic heights (see `rowHeight` doc), so we never attach `measureElement`.
  // The virtualizer's size memo omits `estimateSize` from its key, so when a rowHeight callback would
  // return new values (e.g. a row's content grew after an edit, or a resize changed a width-dependent
  // height) we must re-measure explicitly. Keyed on the row model + height source + committed column
  // widths — all stable across horizontal scroll, so this never fires mid-scroll (or mid-resize-drag,
  // since columnSizing only updates on release with columnResizeMode 'onEnd').
  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowHeight, columnWidths]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const style: CSSProperties = { blockSize: totalSize };

  // Stable identity for the column-range slice of the selection — every in-range row shares it, so
  // memo'd rows don't re-render just because GridBody re-rendered for an unrelated reason.
  const selectionColRange = useMemo(
    () => (selectionRange ? { start: selectionRange.minCol, end: selectionRange.maxCol } : null),
    [selectionRange],
  );

  if (rows.length === 0) {
    return (
      <div role="rowgroup" className="jgrid-body jgrid-body-empty">
        <div role="row" aria-rowindex={2 + summaryRowCount} className="jgrid-empty-row">
          <div role="gridcell" className="jgrid-empty-cell slds-text-align_center slds-p-around_medium slds-text-color_weak">
            No data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="rowgroup" className="jgrid-body" style={style}>
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        // Narrow the active cell to the row it belongs to — passing the (new-identity-per-move) object
        // to every row would defeat GridRow's memo and re-render all mounted rows on each arrow key.
        const rowActiveCell = activeCell && activeCell.rowId === row.id ? activeCell : null;
        if (row.getIsGrouped()) {
          return (
            <GridGroupRow
              key={row.id}
              row={row}
              columns={leafColumns}
              gridTemplateColumns={gridTemplateColumns}
              visibleColumnIndexes={visibleColumnIndexes}
              ariaRowIndex={virtualRow.index + 2 + summaryRowCount}
              rowIndex={virtualRow.index}
              virtualStart={virtualRow.start}
              height={virtualRow.size}
              activeCell={rowActiveCell}
              onCellMouseDown={onCellMouseDown}
              autoHeight={autoRowHeight}
              measureRef={measureRowRef}
            />
          );
        }
        const rowInRange = !!selectionRange && virtualRow.index >= selectionRange.minRow && virtualRow.index <= selectionRange.maxRow;
        return (
          <GridRow
            key={row.id}
            row={row}
            columns={leafColumns}
            gridTemplateColumns={gridTemplateColumns}
            visibleColumnIndexes={visibleColumnIndexes}
            ariaRowIndex={virtualRow.index + 2 + summaryRowCount}
            rowIndex={virtualRow.index}
            virtualStart={virtualRow.start}
            height={virtualRow.size}
            activeCell={rowActiveCell}
            isSelected={row.getIsSelected()}
            isExpanded={row.getIsExpanded()}
            isLastRow={virtualRow.index === rows.length - 1}
            selectionColRange={rowInRange ? selectionColRange : null}
            rowClass={rowClass}
            onCellMouseDown={onCellMouseDown}
            onCellMouseEnter={onCellMouseEnter}
            onCellContextMenu={onCellContextMenu}
            onStartEdit={onStartEdit}
            onCommitRow={onCommitRow}
            autoHeight={autoRowHeight}
            measureRef={measureRowRef}
          />
        );
      })}
    </div>
  );
}
