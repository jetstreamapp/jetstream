/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem } from '@jetstream/types';
import { Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from '../../../form/context-menu/ContextMenu';
import { EditorHost } from '../editors/EditorHost';
import { reorderColumnOrder } from '../grid-column-utils';
import { NON_DATA_COLUMN_KEYS } from '../grid-constants';
import { GridRuntime, GridRuntimeContext } from '../grid-context';
import { computePasteTargets, flashPastedCells, parsePastedText } from '../grid-paste';
import { getSortedFilteredLeafRows } from '../grid-row-utils';
import {
  ColumnWithFilter,
  ContextMenuActionData,
  ContextMenuItems,
  DataTableHeaderProps,
  GridCellRef,
  PasteEvent,
  RowWithKey,
} from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { GridBody, RowHeightFn } from './GridBody';
import { GridHeader } from './GridHeader';
import { ActiveCell } from './GridRow';
import { getGridTemplateColumns } from './grid-layout';

const COPY_RANGE_ACTION = '__COPY_RANGE__';
const COPY_RANGE_WITH_HEADER_ACTION = '__COPY_RANGE_WITH_HEADER__';
const PASTE_RANGE_ACTION = '__PASTE_RANGE__';
const REVERT_RANGE_ACTION = '__REVERT_RANGE__';
// Hard bound on cells examined when deciding whether to show the "Revert" context-menu item, so opening
// the menu over a huge selection (e.g. select-all) can never stall. ~50k O(1) dirty checks is a few ms.
const REVERT_SCAN_CELL_BUDGET = 50_000;

/** Context-menu actions that operate on a column/table (no specific row) — the subset offered when
 * right-clicking a column HEADER. Matches the `ContextAction` values used by the standard
 * TABLE_CONTEXT_MENU_ITEMS; consumer items outside this set are cell-scoped and excluded. */
const COLUMN_SCOPED_CONTEXT_ACTIONS = new Set<unknown>([
  'COPY_COL',
  'COPY_COL_JSON',
  'COPY_COL_NO_HEADER',
  'COPY_TABLE',
  'COPY_TABLE_JSON',
  'COPY_TABLE_CSV',
]);

interface ContextMenuState<TRow = any> {
  area: 'cell' | 'header';
  /** Set for cell menus; absent for header menus. */
  rowId?: string;
  columnId: string;
  element: HTMLElement;
  /** Items resolved when the menu opened (a per-cell builder may have produced these). */
  items: ContextMenuItem[];
  /** Cell action data captured at open time, passed to `contextMenuAction` on selection. */
  actionData: ContextMenuActionData<TRow> | null;
}

export interface GridContainerProps<TRow> {
  table: Table<TRow>;
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
  /** Right-click context menu items — a static list or a per-cell builder (must be stable). */
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

export function GridContainer<TRow = RowWithKey>({
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
    // A popover/modal opened from a cell (via Space/Enter or click) moves focus into its portaled panel;
    // keep the active cell so closing the overlay returns to a live grid coordinate.
    return relatedTarget instanceof HTMLElement && !!relatedTarget.closest('.jgrid-editor, .slds-popover, .slds-modal');
  }, []);

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
    onRequestEdit: startEdit,
    shouldRetainFocusOnBlur,
    summaryRowCount: summaryRows?.length ?? 0,
    onAnnounce: announce,
    onUndo,
    onRedo,
    onClearSelection: onPaste ? stableClearSelection : undefined,
  });

  // Announce the matching row count after the filter set changes (the filtered model is pre-grouping, so
  // this counts data rows and isn't perturbed by expanding/collapsing groups or sorting). Skips the
  // initial render so the grid doesn't announce on mount.
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const previousFilteredRowCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousFilteredRowCountRef.current !== null && previousFilteredRowCountRef.current !== filteredRowCount) {
      announce(`${filteredRowCount} ${filteredRowCount === 1 ? 'row' : 'rows'}`);
    }
    previousFilteredRowCountRef.current = filteredRowCount;
  }, [filteredRowCount, announce]);

  const leafColumns = table.getVisibleLeafColumns();
  const columnSizing = table.getState().columnSizing;

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
  // navigation to off-screen columns brings them into the window before focus resolves.
  useEffect(() => {
    if (!keyboardNav.activeCell || keyboardNav.getLastInteractionSource() === 'select-all') {
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

  const { activeCell, anchorCell } = keyboardNav;
  const selectionRange = useMemo(() => {
    if (!activeCell || !anchorCell) {
      return null;
    }
    const anchorRow = rowIndexById.get(anchorCell.rowId);
    const activeRow = rowIndexById.get(activeCell.rowId);
    const anchorCol = colIndexById.get(anchorCell.columnId);
    const activeCol = colIndexById.get(activeCell.columnId);
    if (anchorRow == null || activeRow == null || anchorCol == null || activeCol == null) {
      return null;
    }
    const minRow = Math.min(anchorRow, activeRow);
    const maxRow = Math.max(anchorRow, activeRow);
    const minCol = Math.min(anchorCol, activeCol);
    const maxCol = Math.max(anchorCol, activeCol);
    // A collapsed (single-cell) selection is just the active cell — no range highlight.
    if (minRow === maxRow && minCol === maxCol) {
      return null;
    }
    return { minRow, maxRow, minCol, maxCol };
  }, [activeCell, anchorCell, rowIndexById, colIndexById]);

  // Resolve the editable cells in the current selection (single active cell or range) for the given
  // fill matrix. Shared by paste (parsed clipboard), clear, and revert (a `[['']]` matrix enumerates
  // every editable cell). Returns empty when the active cell is a header/summary (non-data) cell.
  const getEditableSelectionCells = useCallback(
    (matrix: string[][]): PasteEvent => {
      if (!activeCell) {
        return { cells: [], skippedCount: 0 };
      }
      const activeRow = rowIndexById.get(activeCell.rowId);
      const activeCol = colIndexById.get(activeCell.columnId);
      if (activeRow == null || activeCol == null) {
        return { cells: [], skippedCount: 0 };
      }
      const selRect = selectionRange ?? { minRow: activeRow, maxRow: activeRow, minCol: activeCol, maxCol: activeCol };
      return computePasteTargets({
        rows: rowModelRows,
        columns: leafColumns,
        selRect,
        matrix,
        isColumnEditable: (rowId, columnId) => isColumnEditable({ rowId, columnId }),
        getRowKey,
      });
    },
    [activeCell, rowIndexById, colIndexById, selectionRange, rowModelRows, leafColumns, isColumnEditable, getRowKey],
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
    const { cells, skippedCount } = getEditableSelectionCells([['']]);
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
      const selRect = selectionRange ?? { minRow: activeRow, maxRow: activeRow, minCol: activeCol, maxCol: activeCol };
      let count = 0;
      let scanned = 0;
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
      return count;
    },
    [
      onRevertCells,
      isCellDirty,
      activeCell,
      rowIndexById,
      colIndexById,
      selectionRange,
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
    return getEditableSelectionCells([['']]).cells.filter((cell) => isCellDirty(cell.rowKey, cell.columnKey));
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

  // A static list, or a per-cell builder evaluated against the right-clicked cell (e.g. group-aware
  // "Copy column (Apex Classes)"). The builder returning `[]` suppresses the menu for that cell.
  const resolveCellMenuItems = useCallback(
    (data: ContextMenuActionData<TRow>): ContextMenuItem[] =>
      typeof contextMenuItems === 'function' ? contextMenuItems(data) : Array.isArray(contextMenuItems) ? contextMenuItems : [],
    [contextMenuItems],
  );

  const handleCellContextMenu = useCallback(
    (event: React.MouseEvent, rowId: string, columnId: string) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      const actionData = contextMenuAction ? buildCellActionData(rowId, columnId) : null;
      const items = actionData ? resolveCellMenuItems(actionData) : [];
      // Ctrl/Meta lets the native browser menu through; so does an empty menu with no selection and no
      // paste affordance (the rectangular copy + paste items are injected when the menu renders). Paste
      // requires an active cell to anchor the target, so match the renderer's `onPaste && activeCell`
      // gate — otherwise right-clicking before a cell is focused suppresses the native menu for an
      // empty custom one.
      if (!items.length && !selectionRange && !(onPaste && activeCell)) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      // Re-open on the next tick so an already-open menu closes first (matches legacy behavior).
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'cell', rowId, columnId, element, items, actionData }));
    },
    [contextMenuAction, buildCellActionData, resolveCellMenuItems, selectionRange, onPaste, activeCell],
  );

  // Right-clicking a column HEADER offers the column/table-scoped copy actions — only for a static item
  // list (per-cell builders are cell-scoped). Non-data columns (select/action) keep the native menu.
  const headerContextMenuItems = useMemo(
    () =>
      Array.isArray(contextMenuItems) && contextMenuAction
        ? contextMenuItems.filter((item) => COLUMN_SCOPED_CONTEXT_ACTIONS.has(item.value))
        : [],
    [contextMenuItems, contextMenuAction],
  );
  const handleHeaderContextMenu = useCallback(
    (event: React.MouseEvent, columnId: string) => {
      // Append any consumer-supplied per-column items (e.g. "View field metadata") to the static
      // column-scoped copy actions.
      const extraItems = getColumnHeaderMenuItems?.(columnId) ?? [];
      const items = [...headerContextMenuItems, ...extraItems];
      // Every header item is dispatched through `contextMenuAction` on selection — without it the menu
      // would open but be unusable (selections become no-ops), so don't present it.
      if (event.ctrlKey || event.metaKey || !contextMenuAction || !items.length || NON_DATA_COLUMN_KEYS.has(columnId)) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
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
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'header', columnId, element, items, actionData }));
    },
    [headerContextMenuItems, table, orderedColumns, getColumnHeaderMenuItems, contextMenuAction],
  );

  // Closing the menu can strand DOM focus on <body> (the menu auto-focuses its items and unmounts on
  // selection/Escape). Re-focus the origin cell so keyboard navigation continues — but never steal
  // focus from a click target (outside-click dismissal already moved focus where the user wanted it).
  const closeContextMenu = useCallback(() => {
    const menu = contextMenuRef.current;
    setContextMenu(null);
    requestAnimationFrame(() => {
      const focused = document.activeElement;
      if ((!focused || focused === document.body) && menu?.area === 'cell' && menu.rowId) {
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
  // While a column drag is active and the cursor nears the scroller's left/right edge, nudge the
  // horizontal scroll so more columns (and drop targets) render. The rAF loop runs only during a drag.
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollStepRef = useRef(0);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollStepRef.current = 0;
  }, []);

  const runAutoScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || autoScrollStepRef.current === 0) {
      autoScrollFrameRef.current = null;
      return;
    }
    scroller.scrollLeft += autoScrollStepRef.current;
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
  }, []);

  const handleColumnDragOverScroller = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!draggingColumnId) {
        return;
      }
      const EDGE_SIZE = 60;
      const SCROLL_STEP = 12;
      const rect = event.currentTarget.getBoundingClientRect();
      const distanceFromLeft = event.clientX - rect.left;
      const distanceFromRight = rect.right - event.clientX;
      let step = 0;
      if (distanceFromLeft < EDGE_SIZE) {
        step = -SCROLL_STEP;
      } else if (distanceFromRight < EDGE_SIZE) {
        step = SCROLL_STEP;
      }
      autoScrollStepRef.current = step;
      if (step !== 0 && autoScrollFrameRef.current === null) {
        autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
      } else if (step === 0) {
        stopAutoScroll();
      }
    },
    [draggingColumnId, runAutoScroll, stopAutoScroll],
  );

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumnId(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Stop any in-flight auto-scroll frame when the grid unmounts mid-drag.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

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
              activeCell={keyboardNav.activeCell}
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
              selectionRange={selectionRange}
              onCellMouseDown={keyboardNav.handleCellMouseDown}
              onCellMouseEnter={keyboardNav.handleCellMouseEnter}
              onCellContextMenu={handleCellContextMenu}
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
            const revertableCount = contextMenu.area === 'cell' ? countRevertableSelectionCells(2) : 0;
            // Grid-injected, selection-aware actions (copy/paste/revert), shown above the consumer's items.
            const gridItems: ContextMenuItem[] = [
              ...(selectionRange
                ? [
                    { label: 'Copy selected cells', value: COPY_RANGE_ACTION } as ContextMenuItem,
                    { label: 'Copy selected cells with header', value: COPY_RANGE_WITH_HEADER_ACTION } as ContextMenuItem,
                  ]
                : []),
              ...(onPaste && keyboardNav.activeCell ? [{ label: 'Paste', value: PASTE_RANGE_ACTION } as ContextMenuItem] : []),
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
                  } else if (item.value === PASTE_RANGE_ACTION) {
                    handleContextMenuPaste();
                  } else if (item.value === REVERT_RANGE_ACTION) {
                    revertSelection(getRevertableSelectionCells());
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
