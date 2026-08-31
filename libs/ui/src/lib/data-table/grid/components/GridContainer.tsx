/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem } from '@jetstream/types';
import { shallow, useSelector } from '@tanstack/react-store';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from '../../../form/context-menu/ContextMenu';
import { FILTER_COUNT_ANNOUNCE_DEBOUNCE_MS } from '../../../widgets/AssistiveStatus';
import { EditorHost } from '../editors/EditorHost';
import { computeEdgeScrollVelocity, createEdgeAutoScroller } from '../grid-auto-scroll';
import { copyGridDataToClipboard, copyGridGroupRowsToClipboard, GridCopyResult } from '../grid-clipboard';
import { reorderColumnOrder } from '../grid-column-utils';
import { HEADER_ROW_ID, isSummaryRowId, NON_DATA_COLUMN_KEYS, TABLE_CONTEXT_MENU_ITEMS } from '../grid-constants';
import { GridRuntime, GridRuntimeContext, selectRowModelInputs } from '../grid-context';
import {
  COPY_GROUP_ACTION,
  COPY_GROUP_WITH_HEADER_ACTION,
  COPY_RANGE_ACTION,
  COPY_RANGE_WITH_HEADER_ACTION,
  GRID_OWNED_COPY_ACTIONS,
  GROUP_CONTEXT_MENU_ITEMS,
  PASTE_RANGE_ACTION,
  resolveHeaderContextMenuItems,
  REVERT_RANGE_ACTION,
} from '../grid-context-menu';
import { computePasteTargets, flashPastedCells, parsePastedText } from '../grid-paste';
import { getSortedFilteredLeafRows } from '../grid-row-utils';
import {
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  ContextMenuItems,
  DataTableHeaderProps,
  GridCellRef,
  PasteEvent,
  RowWithKey,
  TanstackTable,
} from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { useGridTabOrderContainment } from '../keyboard/useGridTabOrderContainment';
import { getActiveRangeRect, getSelectionBounds, hasMultiCellSelection } from '../selection/grid-selection';
import { GridBody, RowHeightFn } from './GridBody';
import { GridHeader } from './GridHeader';
import { ActiveCell } from './GridRow';
import { getGridTemplateColumns } from './grid-layout';

// Hard bound on cells examined when deciding whether to show the "Revert" context-menu item, so opening
// the menu over a huge selection (e.g. select-all) can never stall. ~50k O(1) dirty checks is a few ms.
const REVERT_SCAN_CELL_BUDGET = 50_000;

interface ContextMenuState<TRow extends object = any> {
  area: 'cell' | 'header' | 'group';
  /** Set for cell/group menus; absent for header menus. */
  rowId?: string;
  columnId: string;
  element: HTMLElement;
  /** Items resolved when the menu opened (a per-cell builder may have produced these). */
  items: ContextMenuItem[];
  /** Cell action data captured at open time, passed to `contextMenuAction` on selection. Always null for
   * a group menu — that payload is leaf-row-scoped, and a group header has no single row. */
  actionData: ContextMenuActionData<TRow> | null;
}

export interface GridContainerProps<TRow extends object> {
  table: TanstackTable<TRow>;
  gridId: string;
  getRowKey: (row: TRow) => string;
  orderedColumns: ColumnWithFilter<TRow>[];
  role?: 'grid' | 'treegrid';
  ariaLabel?: string;
  className?: string;
  /** Fixed numeric height, or per-row callback. Powers the virtualizer's initial size estimate. */
  rowHeight?: number | RowHeightFn<TRow>;
  overscan?: number;
  rowClass?: (row: TRow) => string | undefined;
  /** Optional header filter popover override (defaults to the built-in HeaderFilterButton). */
  renderFilter?: (props: DataTableHeaderProps<TRow>) => ReactNode;
  /** Called when an inline edit commits; `rows` are the filtered+sorted data rows with the edit applied. */
  onRowsChange?: (rows: TRow[], data: { indexes: number[]; column: ColumnWithFilter<TRow> }) => void;
  /** Called when the user pastes into the selection. The grid resolves the editable target cells; the
   * consumer coerces values + tracks dirty state. Enables Ctrl/Cmd+V and a context-menu "Paste" item. */
  onPaste?: (event: PasteEvent) => void;
  /** Undo the last edit/paste (Ctrl/Cmd+Z); the consumer owns the row-snapshot history. */
  onUndo?: () => void;
  /** Redo the last undone edit (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y). */
  onRedo?: () => void;
  /** Revert the given (modified) cells to their original values — backs the context-menu "Revert" item. */
  onRevertCells?: (cells: GridCellRef[]) => void;
  /** Whether a cell currently holds an unsaved modification — gates the context-menu "Revert" item. */
  isCellDirty?: (rowId: string, columnId: string) => boolean;
  /** Pinned summary rows rendered below the header. */
  summaryRows?: unknown[];
  /** Fixed height (px) for each pinned summary row; content-sized when omitted. */
  summaryRowHeight?: number;
  /** Right-click context menu items — a static list or a per-cell builder (must be stable). Omit to get
   * the standard copy actions dispatched by the grid itself; pass `[]` to opt out of them. (The
   * selection-aware items — copy range / paste / revert / copy group — are always available.) */
  contextMenuItems?: ContextMenuItems<TRow>;
  /** Right-click context menu action handler (must be stable). */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<TRow>) => void;
  /** Consumer-supplied builder for extra per-column header menu items, appended to the static header
   * items. Routed through `contextMenuAction` on selection (with `actionData.column`). Must be stable. */
  getColumnHeaderMenuItems?: (columnId: string) => ContextMenuItem[];
  /** Slot for editor popovers / context menu portals rendered as siblings of the grid. */
  children?: ReactNode;
  /** When true, rows size to their content (cells wrap, DOM-measured) and ALL columns render (horizontal
   * virtualization off) so each row's measured height accounts for every cell. Opt-in per grid. */
  autoRowHeight?: boolean;
}

export function GridContainer<TRow extends object = RowWithKey>({
  table,
  gridId,
  getRowKey,
  orderedColumns,
  role = 'grid',
  ariaLabel,
  className,
  rowHeight,
  overscan,
  rowClass,
  renderFilter,
  onRowsChange,
  onPaste,
  onUndo,
  onRedo,
  onRevertCells,
  isCellDirty,
  summaryRows,
  summaryRowHeight,
  contextMenuItems,
  contextMenuAction,
  getColumnHeaderMenuItems,
  children,
  autoRowHeight,
}: GridContainerProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [editingCell, setEditingCell] = useState<ActiveCell | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Polite live-region message for actions/state changes that are otherwise only visual (copy, filter
  // results). Clear-then-set on the next frame so repeating the same message re-announces it.
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);
  // Column reorder (drag-and-drop). Track which column is in flight so headers can render the dragged
  // state and the scroller can edge-auto-scroll while a drag is active.
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

  // Mirrors for the blur handler — focus moving into the grid's own portaled UI (context menu /
  // popover editor) must not clear the active cell/selection, since those UIs act on it.
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const contextMenuRef = useRef(contextMenu);
  contextMenuRef.current = contextMenu;
  const shouldRetainFocusOnBlur = useCallback((relatedTarget: Node | null): boolean => {
    if (editingCellRef.current || contextMenuRef.current) {
      return true;
    }
    // A popover/modal/dropdown menu opened from a cell (via Space/Enter or click) moves focus into its
    // portaled panel; keep the active cell so closing the overlay returns to a live grid coordinate.
    return relatedTarget instanceof HTMLElement && !!relatedTarget.closest('.jgrid-editor, .slds-popover, .slds-modal, .slds-dropdown');
  }, []);

  // Paste/clear eligibility: `editable` alone (no `renderEditCell` required). Checkbox-style tables
  // (permission manager, automation control) mark columns editable WITHOUT the popup-editor framework —
  // their cells accept pasted values via onPaste but Enter/double-click still activates the checkbox.
  const isCellPasteTarget = useCallback(
    (cell: ActiveCell): boolean => {
      const column = table.getColumn(cell.columnId);
      const editable = column?.columnDef.meta?.jetstream?.editable;
      if (!editable) {
        return false;
      }
      if (typeof editable === 'function') {
        const row = table.getRowModel().rows.find((candidate) => candidate.id === cell.rowId);
        return !!row && editable(row.original);
      }
      return editable === true;
    },
    [table],
  );

  const isColumnEditable = useCallback(
    (cell: ActiveCell): boolean => {
      const column = table.getColumn(cell.columnId);
      const meta = column?.columnDef.meta?.jetstream;
      const editable = meta?.editable;
      if (!editable || !meta?.editor) {
        return false;
      }
      if (typeof editable === 'function') {
        const row = table.getRowModel().rows.find((candidate) => candidate.id === cell.rowId);
        return !!row && editable(row.original);
      }
      return editable === true;
    },
    [table],
  );

  const startEdit = useCallback(
    (cell: ActiveCell): boolean => {
      if (!onRowsChange || !isColumnEditable(cell)) {
        return false;
      }
      setEditingCell(cell);
      return true;
    },
    [onRowsChange, isColumnEditable],
  );

  const handleStartEdit = useCallback((rowId: string, columnId: string) => void startEdit({ rowId, columnId }), [startEdit]);

  const focusCellEl = useCallback((cell: ActiveCell) => {
    const cellEl = gridRef.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(cell.rowId)}"][data-col-id="${CSS.escape(cell.columnId)}"]`,
    );
    cellEl?.focus();
  }, []);

  const handleEditorClose = useCallback(
    (_commit?: boolean, focusCell?: boolean) => {
      const cell = editingCell;
      setEditingCell(null);
      if (focusCell && cell) {
        // Defer so the editor unmounts before we move focus back to the cell.
        setTimeout(() => focusCellEl(cell));
      }
    },
    [editingCell, focusCellEl],
  );

  // Commit path shared by the popover editor and in-cell renderers (e.g. a checkbox calling
  // `commitEdit(row)`). Consumers receive only DATA rows — synthetic group header rows are excluded
  // and collapsed groups' leaves are included, with `indexes` relative to that list. This matches the
  // legacy react-data-grid contract (group rows would appear as duplicates of each group's first leaf
  // and corrupt consumer state reconciliation).
  const handleCommitRow = useCallback(
    (updatedRow: TRow, rowId: string, column: ColumnWithFilter<TRow>) => {
      if (!onRowsChange) {
        return;
      }
      const leafRows = getSortedFilteredLeafRows(table);
      const rowIndex = leafRows.findIndex((modelRow) => modelRow.id === rowId);
      if (rowIndex < 0) {
        return;
      }
      const displayRows = leafRows.map((modelRow, index) => (index === rowIndex ? updatedRow : modelRow.original));
      onRowsChange(displayRows, { indexes: [rowIndex], column });
    },
    [onRowsChange, table],
  );

  // In-cell commit from renderers — they only know their coordinates, so resolve the column by id.
  const handleCellCommit = useCallback(
    (updatedRow: TRow, rowId: string, columnId: string) => {
      const column = table.getColumn(columnId)?.columnDef.meta?.jetstream?.column as ColumnWithFilter<TRow> | undefined;
      if (column) {
        handleCommitRow(updatedRow, rowId, column);
      }
    },
    [handleCommitRow, table],
  );

  // `clearSelection` needs post-hook state (the selection rectangle), but the keyboard hook needs the
  // clear handler — break the cycle with a live ref so the stable wrapper always calls the latest impl.
  const clearSelectionRef = useRef<() => void>(() => undefined);
  const stableClearSelection = useCallback(() => clearSelectionRef.current(), []);

  const keyboardNav = useGridKeyboardNavigation({
    table,
    getRootElement: () => gridRef.current,
    getScrollElement: () => scrollRef.current,
    onRequestEdit: startEdit,
    shouldRetainFocusOnBlur,
    summaryRowCount: summaryRows?.length ?? 0,
    onAnnounce: announce,
    onUndo,
    onRedo,
    onClearSelection: onPaste ? stableClearSelection : undefined,
  });

  // The grid is a single page tab stop — strip consumer-rendered in-cell controls from the tab order.
  useGridTabOrderContainment(useCallback(() => gridRef.current, []));

  // Announce the matching row count after the filter set changes (the filtered model is pre-grouping, so
  // this counts data rows and isn't perturbed by expanding/collapsing groups or sorting). Skips the
  // initial render so the grid doesn't announce on mount.
  // Correctness linchpin now that `expanded` bypasses React state: the row model must be re-read
  // (rowIndexById, the row-count announcer, context menus) whenever any of its inputs change — this
  // subscription is what re-renders the container for internal-mode expand/collapse.
  useSelector(table.store, selectRowModelInputs, { compare: shallow });

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const previousFilteredRowCountRef = useRef<number | null>(null);
  useEffect(() => {
    const previousCount = previousFilteredRowCountRef.current;
    previousFilteredRowCountRef.current = filteredRowCount;
    if (previousCount === null || previousCount === filteredRowCount) {
      return;
    }
    // Debounced: quick-filter typing changes the count every keystroke, and screen readers drop
    // polite live-region churn during typing — announce once after the count settles
    const timeout = window.setTimeout(() => {
      announce(`${filteredRowCount} ${filteredRowCount === 1 ? 'row' : 'rows'}`);
    }, FILTER_COUNT_ANNOUNCE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [filteredRowCount, announce]);

  const leafColumns = table.getVisibleLeafColumns();
  const columnSizing = table.store.state.columnSizing;

  // Recompute the grid template whenever sizing changes. With `columnResizeMode: 'onEnd'` widths only
  // change when the drag is released (columnSizing updates), so this intentionally does NOT depend on
  // columnSizingInfo — depending on it would recompute on every mousemove of a resize drag.
  const gridTemplateColumns = useMemo(
    () => getGridTemplateColumns(leafColumns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leafColumns, columnSizing],
  );
  const totalWidth = table.getTotalSize();

  // Single shared horizontal virtualizer so the header, body, group, and summary rows window the exact
  // same set of columns and therefore stay perfectly aligned. The vertical scroll element also owns
  // horizontal scroll (the `.jgrid` is wider than the viewport), so we measure against it.
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: leafColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => leafColumns[index].getSize(),
    overscan: 3,
  });

  // Re-measure when column sizes/order change so the windowed tracks reflect the latest widths.
  useEffect(() => {
    columnVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing, leafColumns.length]);

  const virtualColumns = columnVirtualizer.getVirtualItems();

  // Frozen (sticky-left) columns must render at EVERY horizontal scroll position. The virtualizer windows
  // them out the moment you scroll past their tracks, which unmounts them and makes the pinned columns
  // vanish mid-scroll. Union the always-on frozen indexes with the windowed indexes — positioning is pure
  // CSS grid (gridColumnStart + sticky offset), so the rendered set only needs to *include* them.
  const frozenColumnIndexes = useMemo(() => {
    const indexes: number[] = [];
    leafColumns.forEach((column, index) => {
      if (column.columnDef.meta?.jetstream?.frozen) {
        indexes.push(index);
      }
    });
    return indexes;
  }, [leafColumns]);
  const windowedColumnIndexes = useMemo(() => {
    const indexes = new Set<number>(frozenColumnIndexes);
    for (const virtualColumn of virtualColumns) {
      indexes.add(virtualColumn.index);
    }
    return Array.from(indexes).sort((a, b) => a - b);
  }, [virtualColumns, frozenColumnIndexes]);
  const allColumnIndexes = useMemo(() => leafColumns.map((_, index) => index), [leafColumns]);
  // Auto-height rows are DOM-measured, so every column must render (otherwise a row's measured height
  // would miss cells outside the horizontal window). Trade horizontal virtualization for correct heights.
  const visibleColumnIndexes = autoRowHeight ? allColumnIndexes : windowedColumnIndexes;

  // Scroll the active column into view (mirrors the active-row logic in GridBody) so keyboard
  // navigation to off-screen columns brings them into the window before focus resolves. Skipped while
  // a range drag auto-scrolls: `align: 'auto'` resolves to `'end'` for the partially-visible edge
  // column, so it would snap a full column width on every extend and override the velocity ramp.
  useEffect(() => {
    const interactionSource = keyboardNav.getLastInteractionSource();
    if (!keyboardNav.activeCell || interactionSource === 'select-all' || interactionSource === 'drag-autoscroll') {
      return;
    }
    const index = leafColumns.findIndex((column) => column.id === keyboardNav.activeCell!.columnId);
    if (index >= 0) {
      columnVirtualizer.scrollToIndex(index, { align: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardNav.activeCell?.columnId]);

  const runtime: GridRuntime<TRow> = useMemo(
    () => ({ table, gridId, getRowKey, columns: orderedColumns }),
    [table, gridId, getRowKey, orderedColumns],
  );

  const rowModelRows = table.getRowModel().rows;
  const rowCount = rowModelRows.length;
  const gridStyle: CSSProperties = { inlineSize: totalWidth, minInlineSize: '100%' };

  // Display-index lookups (rebuilt only when the row model / column order changes) so the selection
  // rectangle bounds resolve in O(1) per render instead of O(rows).
  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rowModelRows.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [rowModelRows]);
  const colIndexById = useMemo(() => {
    const map = new Map<string, number>();
    leafColumns.forEach((column, index) => map.set(column.id, index));
    return map;
  }, [leafColumns]);

  const { activeCell } = keyboardNav;
  // Narrow the active cell to the sticky header/summary block. GridHeader is memoized, so handing it
  // the raw (new-identity-per-move) activeCell would re-render the whole header on every body-cell
  // arrow key; with this narrowing it only re-renders when focus enters/leaves/moves within the block.
  const stickyActiveCell = useMemo(
    () => (activeCell && (activeCell.rowId === HEADER_ROW_ID || isSummaryRowId(activeCell.rowId)) ? activeCell : null),
    [activeCell],
  );
  // Re-render on any cell-selection change (the slice is atom-owned, so nothing above re-renders for
  // it); the bounds read below is a memoized core lookup and stays fresh at render time.
  const cellSelectionState = useSelector(table.atoms.cellSelection, (selection) => selection);
  const selectionBounds = useMemo(
    () => getSelectionBounds(table),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, cellSelectionState, rowIndexById, colIndexById],
  );
  const hasRangeSelection = hasMultiCellSelection(selectionBounds);
  // Single-rectangle view of the ACTIVE range for paste/clear/revert targeting (Excel parity: those
  // operate on one rectangle). Null when the selection is collapsed to a single cell — same contract
  // as the legacy anchor/active-derived shape.
  const selectionRange = useMemo(() => {
    const rect = getActiveRangeRect(table);
    return rect && (rect.minRow !== rect.maxRow || rect.minCol !== rect.maxCol) ? rect : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, cellSelectionState, rowIndexById, colIndexById]);

  // Resolve the editable cells in the current selection for the given fill matrix. Shared by paste
  // (parsed clipboard), clear, and revert (a `[['']]` matrix enumerates every editable cell). Paste
  // targets the ACTIVE rectangle only (Excel parity — pasting into disjoint ranges is ambiguous);
  // clear/revert pass `scope: 'all'` to hit every selection rectangle. Returns empty when the active
  // cell is a header/summary (non-data) cell.
  const getEditableSelectionCells = useCallback(
    (matrix: string[][], scope: 'active' | 'all' = 'active'): PasteEvent => {
      if (!activeCell) {
        return { cells: [], skippedCount: 0 };
      }
      const activeRow = rowIndexById.get(activeCell.rowId);
      const activeCol = colIndexById.get(activeCell.columnId);
      if (activeRow == null || activeCol == null) {
        return { cells: [], skippedCount: 0 };
      }
      const fallbackRect = { minRow: activeRow, maxRow: activeRow, minCol: activeCol, maxCol: activeCol };
      const rects =
        scope === 'all' && selectionBounds.length
          ? selectionBounds.map((rect) => ({
              minRow: rect.minRowIndex,
              maxRow: rect.maxRowIndex,
              minCol: rect.minColumnIndex,
              maxCol: rect.maxColumnIndex,
            }))
          : [selectionRange ?? fallbackRect];
      const combined: PasteEvent = { cells: [], skippedCount: 0 };
      const seen = new Set<string>();
      for (const selRect of rects) {
        const { cells, skippedCount } = computePasteTargets({
          rows: rowModelRows,
          columns: leafColumns,
          selRect,
          matrix,
          isColumnEditable: (rowId, columnId) => isCellPasteTarget({ rowId, columnId }),
          getRowKey,
        });
        combined.skippedCount += skippedCount;
        for (const cell of cells) {
          const key = `${cell.rowKey}::${cell.columnKey}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined.cells.push(cell);
          }
        }
      }
      return combined;
    },
    [activeCell, rowIndexById, colIndexById, selectionRange, selectionBounds, rowModelRows, leafColumns, isCellPasteTarget, getRowKey],
  );

  // ── Paste (Ctrl/Cmd+V + context menu) ──────────────────────────────────────────────────────────
  // The active cell is snapshotted at call time so it survives the async context-menu clipboard read.
  const handlePasteText = useCallback(
    (text: string) => {
      if (!onPaste) {
        return;
      }
      const matrix = parsePastedText(text);
      if (!matrix.length) {
        return;
      }
      const { cells, skippedCount } = getEditableSelectionCells(matrix);
      if (!cells.length) {
        announce(skippedCount ? 'No editable cells to paste into.' : 'Nothing to paste.');
        return;
      }
      onPaste({ cells, skippedCount, source: 'paste' });
      flashPastedCells(gridRef.current, new Set(cells.map((cell) => `${cell.rowKey}::${cell.columnKey}`)));
      announce(
        `Pasted ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}${skippedCount ? `, skipped ${skippedCount} read-only` : ''}.`,
      );
    },
    [onPaste, getEditableSelectionCells, announce],
  );

  // Primary entry: the native paste ClipboardEvent fires on Ctrl/Cmd+V while a cell holds focus. Reading
  // clipboardData here (vs navigator.clipboard.readText) works in every browser, needs no permission
  // prompt, and keeps the selection intact. stopPropagation prevents a nested grid from double-pasting.
  const handleDomPaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (!onPaste || !activeCell || editingCell) {
        return;
      }
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (!text) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handlePasteText(text);
    },
    [onPaste, activeCell, editingCell, handlePasteText],
  );

  // Secondary entry: the right-click "Paste" item — there is no ClipboardEvent, so read asynchronously.
  // May be blocked (Firefox/Safari permissions); fall back to guiding the user to the keyboard shortcut.
  const handleContextMenuPaste = useCallback(() => {
    if (!navigator.clipboard?.readText) {
      announce('Pasting from the menu is not supported here. Use Ctrl or Cmd + V.');
      return;
    }
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) {
          handlePasteText(text);
        }
      })
      .catch(() => announce('Unable to read the clipboard. Use Ctrl or Cmd + V to paste.'));
  }, [handlePasteText, announce]);

  // Delete/Backspace clears the editable cells in the selection — implemented as pasting an empty value
  // across the selection (single-value fill), so it reuses onPaste's coercion + dirty/validation pipeline.
  const clearSelection = useCallback(() => {
    if (!onPaste) {
      return;
    }
    const { cells, skippedCount } = getEditableSelectionCells([['']], 'all');
    if (!cells.length) {
      return;
    }
    onPaste({ cells, skippedCount, source: 'clear' });
    flashPastedCells(gridRef.current, new Set(cells.map((cell) => `${cell.rowKey}::${cell.columnKey}`)));
    announce(`Cleared ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}.`);
  }, [onPaste, getEditableSelectionCells, announce]);
  clearSelectionRef.current = clearSelection;

  // Cheap gate for the "Revert" context-menu item: counts modified editable cells in the selection but
  // stops at `cap` — we only need 0 / 1 / many to decide whether to show the item and singular vs plural
  // label. Two bounds keep menu-open work small: the O(1) dirty check runs before the pricier editability
  // check (clean cells — the overwhelming majority — cost a map lookup), and the scan gives up after
  // REVERT_SCAN_CELL_BUDGET cells and returns `cap` ("assume many"), so a huge selection at worst shows a
  // "Revert changes" item that reverts nothing. The complete cell list is computed lazily via
  // getRevertableSelectionCells() only once the user actually picks "Revert".
  const countRevertableSelectionCells = useCallback(
    (cap: number): number => {
      if (!onRevertCells || !isCellDirty || !activeCell) {
        return 0;
      }
      const activeRow = rowIndexById.get(activeCell.rowId);
      const activeCol = colIndexById.get(activeCell.columnId);
      if (activeRow == null || activeCol == null) {
        return 0;
      }
      const rects = selectionBounds.length
        ? selectionBounds.map((rect) => ({
            minRow: rect.minRowIndex,
            maxRow: rect.maxRowIndex,
            minCol: rect.minColumnIndex,
            maxCol: rect.maxColumnIndex,
          }))
        : [{ minRow: activeRow, maxRow: activeRow, minCol: activeCol, maxCol: activeCol }];
      let count = 0;
      let scanned = 0;
      for (const selRect of rects) {
        for (let rowIndex = selRect.minRow; rowIndex <= selRect.maxRow; rowIndex++) {
          const row = rowModelRows[rowIndex];
          // Synthetic group/aggregate rows have no editable data cells.
          if (!row || row.getIsGrouped?.()) {
            continue;
          }
          const rowKey = getRowKey(row.original);
          for (let colIndex = selRect.minCol; colIndex <= selRect.maxCol; colIndex++) {
            if (++scanned > REVERT_SCAN_CELL_BUDGET) {
              return cap;
            }
            const column = leafColumns[colIndex];
            if (!column || !isCellDirty(rowKey, column.id)) {
              continue;
            }
            if (isColumnEditable({ rowId: row.id, columnId: column.id })) {
              count++;
              if (count >= cap) {
                return count;
              }
            }
          }
        }
      }
      return count;
    },
    [
      onRevertCells,
      isCellDirty,
      activeCell,
      rowIndexById,
      colIndexById,
      selectionBounds,
      rowModelRows,
      leafColumns,
      isColumnEditable,
      getRowKey,
    ],
  );

  // The modified, editable cells in the current selection — drives the actual revert on menu selection.
  const getRevertableSelectionCells = useCallback((): GridCellRef[] => {
    if (!onRevertCells || !isCellDirty) {
      return [];
    }
    return getEditableSelectionCells([['']], 'all').cells.filter((cell) => isCellDirty(cell.rowKey, cell.columnKey));
  }, [onRevertCells, isCellDirty, getEditableSelectionCells]);

  const revertSelection = useCallback(
    (cells: GridCellRef[]) => {
      if (!onRevertCells || !cells.length) {
        return;
      }
      onRevertCells(cells);
      flashPastedCells(gridRef.current, new Set(cells.map((cell) => `${cell.rowKey}::${cell.columnKey}`)));
      announce(`Reverted ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}.`);
    },
    [onRevertCells, announce],
  );

  // Resolve the right-clicked cell to the consumer-facing action data (leaf rows only; group rows are
  // excluded). Returns null for a group header / column with no data column.
  const buildCellActionData = useCallback(
    (rowId: string, columnId: string): ContextMenuActionData<TRow> | null => {
      const leafRows = getSortedFilteredLeafRows(table);
      const rowIndex = leafRows.findIndex((modelRow) => modelRow.id === rowId);
      const column = table.getColumn(columnId)?.columnDef.meta?.jetstream?.column;
      if (rowIndex < 0 || !column) {
        return null;
      }
      return {
        row: leafRows[rowIndex].original,
        rows: leafRows.map((modelRow) => modelRow.original),
        rowIdx: rowIndex,
        column,
        columns: orderedColumns,
      };
    },
    [table, orderedColumns],
  );

  // A table that supplies no `contextMenuItems` gets the standard copy actions for free, dispatched by
  // the grid (`copyGridDataToClipboard`) rather than a consumer handler. An explicit `[]` opts out.
  const usesGridOwnedMenu = contextMenuItems === undefined;
  const resolvedContextMenuItems: ContextMenuItems<TRow> = contextMenuItems ?? TABLE_CONTEXT_MENU_ITEMS;
  const canDispatchMenuItems = usesGridOwnedMenu || !!contextMenuAction;

  // A static list, or a per-cell builder evaluated against the right-clicked cell (e.g. group-aware
  // "Copy column (Apex Classes)"). The builder returning `[]` suppresses the menu for that cell.
  const resolveCellMenuItems = useCallback(
    (data: ContextMenuActionData<TRow>): ContextMenuItem[] =>
      typeof resolvedContextMenuItems === 'function' ? resolvedContextMenuItems(data) : resolvedContextMenuItems,
    [resolvedContextMenuItems],
  );

  const handleCellContextMenu = useCallback(
    (event: React.MouseEvent, rowId: string, columnId: string) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      // The grid-owned menu is pure copy actions, so it has nothing to offer on the select/action columns
      // (a consumer's own items may still be meaningful there, so this only applies to the grid's).
      const isGridMenuOnNonDataColumn = usesGridOwnedMenu && table.getColumn(columnId)?.columnDef.meta?.jetstream?.cellKind !== 'data';
      const actionData = canDispatchMenuItems && !isGridMenuOnNonDataColumn ? buildCellActionData(rowId, columnId) : null;
      const items = actionData ? resolveCellMenuItems(actionData) : [];
      // Ctrl/Meta lets the native browser menu through; so does an empty menu with no selection and no
      // paste affordance (the rectangular copy + paste items are injected when the menu renders). Paste
      // requires an active cell to anchor the target, so match the renderer's `onPaste && activeCell`
      // gate — otherwise right-clicking before a cell is focused suppresses the native menu for an
      // empty custom one.
      if (!items.length && !hasRangeSelection && !(onPaste && activeCell)) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      // Re-open on the next tick so an already-open menu closes first (matches legacy behavior).
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'cell', rowId, columnId, element, items, actionData }));
    },
    [table, canDispatchMenuItems, usesGridOwnedMenu, buildCellActionData, resolveCellMenuItems, hasRangeSelection, onPaste, activeCell],
  );

  // Right-clicking a GROUP header row copies that group's data rows. Always grid-owned: a consumer's
  // items are built from (and act on) a single leaf row, which a group header doesn't have.
  const handleGroupContextMenu = useCallback((event: React.MouseEvent, rowId: string, columnId: string) => {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    setContextMenu(null);
    setTimeout(() => setContextMenu({ area: 'group', rowId, columnId, element, items: GROUP_CONTEXT_MENU_ITEMS, actionData: null }));
  }, []);

  // Right-clicking a column HEADER offers the column/table-scoped copy actions (see
  // `resolveHeaderContextMenuItems`). Non-data columns keep the native menu.
  const handleHeaderContextMenu = useCallback(
    (event: React.MouseEvent, columnId: string) => {
      // Every header item is dispatched on selection — by the grid, or through `contextMenuAction`.
      // Without either the menu would open but be unusable (selections become no-ops), so don't present it.
      if (event.ctrlKey || event.metaKey || !canDispatchMenuItems || NON_DATA_COLUMN_KEYS.has(columnId)) {
        return;
      }
      // Column/table actions operate over the whole column — anchor on the first leaf row when present.
      // Build the payload directly (rather than via buildCellActionData) so header-only actions like
      // "View field metadata", which read just the column, still fire when the table has no rows.
      const leafRows = getSortedFilteredLeafRows(table);
      const column = table.getColumn(columnId)?.columnDef.meta?.jetstream?.column;
      const actionData: ContextMenuActionData<TRow> | null = column
        ? {
            row: leafRows[0]?.original as TRow,
            rows: leafRows.map((modelRow) => modelRow.original),
            rowIdx: leafRows.length ? 0 : -1,
            column,
            columns: orderedColumns,
          }
        : null;
      // Append any consumer-supplied per-column items (e.g. "View field metadata") to the copy actions.
      // These dispatch only through `contextMenuAction`, so without it they'd render but no-op on select.
      const items = [
        ...resolveHeaderContextMenuItems(resolvedContextMenuItems, actionData),
        ...(contextMenuAction ? (getColumnHeaderMenuItems?.(columnId) ?? []) : []),
      ];
      if (!items.length) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'header', columnId, element, items, actionData }));
    },
    [canDispatchMenuItems, resolvedContextMenuItems, table, orderedColumns, getColumnHeaderMenuItems, contextMenuAction],
  );

  // ── Grid-owned copy dispatch (the default menu + the group-row menu) ────────────────────────────
  const announceCopy = useCallback(
    (result: GridCopyResult | null) => {
      if (!result) {
        announce('Nothing to copy.');
        return;
      }
      const { rowCount, columnCount } = result;
      announce(`Copied ${rowCount} ${rowCount === 1 ? 'row' : 'rows'} by ${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`);
    },
    [announce],
  );

  const copyMenuTarget = useCallback(
    (menu: ContextMenuState<TRow>, action: ContextAction) => {
      const row = menu.rowId ? rowModelRows.find((modelRow) => modelRow.id === menu.rowId) : null;
      announceCopy(copyGridDataToClipboard({ table, action, row, column: table.getColumn(menu.columnId) }));
    },
    [table, rowModelRows, announceCopy],
  );

  const copyGroupRows = useCallback(
    (rowId: string | undefined, includeHeader: boolean) => {
      const groupRow = rowId ? rowModelRows.find((modelRow) => modelRow.id === rowId) : null;
      announceCopy(groupRow ? copyGridGroupRowsToClipboard(table, groupRow, includeHeader) : null);
    },
    [table, rowModelRows, announceCopy],
  );

  // Closing the menu can strand DOM focus on <body> (the menu auto-focuses its items and unmounts on
  // selection/Escape). Re-focus the origin cell so keyboard navigation continues — but never steal
  // focus from a click target (outside-click dismissal already moved focus where the user wanted it).
  const closeContextMenu = useCallback(() => {
    const menu = contextMenuRef.current;
    setContextMenu(null);
    requestAnimationFrame(() => {
      const focused = document.activeElement;
      if ((!focused || focused === document.body) && menu?.area !== 'header' && menu?.rowId) {
        focusCellEl({ rowId: menu.rowId, columnId: menu.columnId });
      }
    });
  }, [focusCellEl]);

  // ── Column reorder (drag-and-drop) ──────────────────────────────────────────────────────────────
  const handleColumnReorder = useCallback(
    (sourceColumnId: string, targetColumnId: string, side: 'left' | 'right') => {
      table.setColumnOrder((order) => reorderColumnOrder(order, sourceColumnId, targetColumnId, side));
    },
    [table],
  );

  // Edge auto-scroll: because columns are horizontally virtualized, the drop target may be off-screen.
  // While a column drag is active and the cursor nears the scroller's left/right edge, scroll
  // horizontally so more columns (and drop targets) render. Shares the range drag's scroller, so the
  // speed is in px/sec and stays the same on a 120Hz display.
  const [columnDragAutoScroll] = useState(() => createEdgeAutoScroller({ getScrollElement: () => scrollRef.current }));

  const handleColumnDragOverScroller = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!draggingColumnId) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const { x } = computeEdgeScrollVelocity({
        box: { top: rect.top, right: rect.left + event.currentTarget.clientWidth, bottom: rect.bottom, left: rect.left },
        clientX: event.clientX,
        clientY: event.clientY,
      });
      columnDragAutoScroll.setVelocity({ x, y: 0 });
    },
    [columnDragAutoScroll, draggingColumnId],
  );

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumnId(null);
    columnDragAutoScroll.stop();
  }, [columnDragAutoScroll]);

  // Stop any in-flight auto-scroll frame when the grid unmounts mid-drag.
  useEffect(() => columnDragAutoScroll.stop, [columnDragAutoScroll]);

  return (
    <GridRuntimeContext.Provider value={runtime as GridRuntime}>
      <div className={classNames('jgrid-root', className)}>
        <div
          ref={scrollRef}
          className="jgrid-scroller"
          onDragOver={draggingColumnId ? handleColumnDragOverScroller : undefined}
          onDrop={draggingColumnId ? handleColumnDragEnd : undefined}
        >
          <div
            ref={gridRef}
            role={role}
            data-id={gridId}
            aria-label={ariaLabel || 'Data table'}
            aria-rowcount={rowCount + 1 + (summaryRows?.length ?? 0)}
            aria-colcount={leafColumns.length}
            aria-multiselectable={table.options.enableRowSelection ? true : undefined}
            className="jgrid"
            style={gridStyle}
            tabIndex={keyboardNav.activeCell ? -1 : 0}
            onKeyDown={keyboardNav.handleKeyDown}
            onPaste={onPaste ? handleDomPaste : undefined}
            onFocus={keyboardNav.handleRootFocus}
            onBlur={keyboardNav.handleRootBlur}
          >
            <GridHeader
              table={table}
              gridTemplateColumns={gridTemplateColumns}
              visibleColumnIndexes={visibleColumnIndexes}
              renderFilter={renderFilter}
              summaryRows={summaryRows}
              summaryRowHeight={summaryRowHeight}
              onHeaderContextMenu={handleHeaderContextMenu}
              stickyActiveCell={stickyActiveCell}
              onHeaderCellMouseDown={keyboardNav.handleHeaderCellMouseDown}
              onSummaryCellMouseDown={keyboardNav.handleSummaryCellMouseDown}
              draggingColumnId={draggingColumnId}
              onColumnDragStart={setDraggingColumnId}
              onColumnDragEnd={handleColumnDragEnd}
              onColumnReorder={handleColumnReorder}
            />
            <GridBody
              table={table}
              scrollRef={scrollRef}
              gridTemplateColumns={gridTemplateColumns}
              visibleColumnIndexes={visibleColumnIndexes}
              rowHeight={rowHeight}
              overscan={overscan}
              summaryRowCount={summaryRows?.length ?? 0}
              activeCell={keyboardNav.activeCell}
              mode={keyboardNav.mode}
              getLastInteractionSource={keyboardNav.getLastInteractionSource}
              editingCell={editingCell}
              selectionBounds={selectionBounds}
              onCellMouseDown={keyboardNav.handleCellMouseDown}
              onCellMouseEnter={keyboardNav.handleCellMouseEnter}
              onCellContextMenu={handleCellContextMenu}
              onGroupContextMenu={handleGroupContextMenu}
              rowClass={rowClass}
              onStartEdit={handleStartEdit}
              onCommitRow={handleCellCommit}
              autoRowHeight={autoRowHeight}
            />
          </div>
        </div>

        {/* Screen-reader announcement of the current navigation/actionable mode. */}
        <span className="slds-assistive-text" aria-live="polite">
          {keyboardNav.mode === 'actionable' ? 'Actionable mode' : 'Navigation mode'}
        </span>

        {/* Screen-reader feedback for actions/state changes that are otherwise only visual (copy, filter results). */}
        <span className="slds-assistive-text" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>

        {editingCell && (
          <EditorHost
            // Key by cell so the editor's draft-row state resets when editing moves to another cell.
            key={`${editingCell.rowId}:${editingCell.columnId}`}
            editingCell={editingCell}
            table={table}
            getRootElement={() => gridRef.current}
            onCommitRow={handleCommitRow}
            onClose={handleEditorClose}
          />
        )}

        {contextMenu &&
          (() => {
            // Capped count of modified editable cells under the right-clicked selection; gates the "Revert"
            // item and picks its label without enumerating the whole selection (full list computed on click).
            // Selection-scoped like the copy items, so group-header menus get it too (revert skips group
            // rows); header menus render no grid items at all.
            const revertableCount = contextMenu.area !== 'header' ? countRevertableSelectionCells(2) : 0;
            // Grid-injected, selection-aware actions (copy/paste/revert), shown above the consumer's items.
            const gridItems: ContextMenuItem[] = [
              ...(hasRangeSelection
                ? [
                    { label: 'Copy selected cells', value: COPY_RANGE_ACTION } as ContextMenuItem,
                    { label: 'Copy selected cells with header', value: COPY_RANGE_WITH_HEADER_ACTION } as ContextMenuItem,
                  ]
                : []),
              // A group header row has no editable cells to anchor a paste on.
              ...(onPaste && keyboardNav.activeCell && contextMenu.area !== 'group'
                ? [{ label: 'Paste', value: PASTE_RANGE_ACTION } as ContextMenuItem]
                : []),
              ...(revertableCount
                ? [
                    {
                      label: revertableCount === 1 ? 'Revert change' : 'Revert changes',
                      value: REVERT_RANGE_ACTION,
                    } as ContextMenuItem,
                  ]
                : []),
            ];
            // Divider only when grid items are followed by the consumer's own items.
            if (gridItems.length && contextMenu.items.length) {
              gridItems[gridItems.length - 1] = { ...gridItems[gridItems.length - 1], trailingDivider: true };
            }
            const menuItems: ContextMenuItem[] = contextMenu.area === 'header' ? contextMenu.items : [...gridItems, ...contextMenu.items];
            if (!menuItems.length) {
              return null;
            }
            return (
              <ContextMenu
                parentElement={contextMenu.element}
                items={menuItems}
                onClose={closeContextMenu}
                onSelected={(item) => {
                  if (item.value === COPY_RANGE_ACTION) {
                    keyboardNav.copySelection();
                  } else if (item.value === COPY_RANGE_WITH_HEADER_ACTION) {
                    keyboardNav.copySelection(true);
                  } else if (item.value === COPY_GROUP_ACTION || item.value === COPY_GROUP_WITH_HEADER_ACTION) {
                    copyGroupRows(contextMenu.rowId, item.value === COPY_GROUP_WITH_HEADER_ACTION);
                  } else if (item.value === PASTE_RANGE_ACTION) {
                    handleContextMenuPaste();
                  } else if (item.value === REVERT_RANGE_ACTION) {
                    revertSelection(getRevertableSelectionCells());
                  } else if (usesGridOwnedMenu && GRID_OWNED_COPY_ACTIONS.has(item.value)) {
                    copyMenuTarget(contextMenu, item.value as ContextAction);
                  } else if (contextMenuAction && contextMenu.actionData) {
                    // Action data (leaf rows only; group rows excluded) was captured when the menu opened.
                    contextMenuAction(item, contextMenu.actionData);
                  }
                  closeContextMenu();
                }}
              />
            );
          })()}
        {children}
      </div>
    </GridRuntimeContext.Provider>
  );
}
