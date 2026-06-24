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
import { getSortedFilteredLeafRows } from '../grid-row-utils';
import { ColumnWithFilter, ContextMenuActionData, ContextMenuItems, DataTableHeaderProps, RowWithKey } from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { GridBody, RowHeightFn } from './GridBody';
import { GridHeader } from './GridHeader';
import { ActiveCell } from './GridRow';
import { getGridTemplateColumns } from './grid-layout';

const COPY_RANGE_ACTION = '__COPY_RANGE__';
const COPY_RANGE_WITH_HEADER_ACTION = '__COPY_RANGE_WITH_HEADER__';

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
  summaryRows,
  summaryRowHeight,
  contextMenuItems,
  contextMenuAction,
  getColumnHeaderMenuItems,
  children,
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

  const keyboardNav = useGridKeyboardNavigation({
    table,
    getRootElement: () => gridRef.current,
    onRequestEdit: startEdit,
    shouldRetainFocusOnBlur,
    summaryRowCount: summaryRows?.length ?? 0,
    onAnnounce: announce,
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
  const visibleColumnIndexes = useMemo(() => {
    const indexes = new Set<number>(frozenColumnIndexes);
    for (const virtualColumn of virtualColumns) {
      indexes.add(virtualColumn.index);
    }
    return Array.from(indexes).sort((a, b) => a - b);
  }, [virtualColumns, frozenColumnIndexes]);

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
      // Ctrl/Meta lets the native browser menu through; so does an empty menu with no active selection.
      if (!items.length && !selectionRange) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      // Re-open on the next tick so an already-open menu closes first (matches legacy behavior).
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'cell', rowId, columnId, element, items, actionData }));
    },
    [contextMenuAction, buildCellActionData, resolveCellMenuItems, selectionRange],
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
            // Cell menus prepend the rectangular-selection copy actions; items were resolved at open time
            // (a per-cell builder may have produced them). Header menus use their column-scoped items.
            const menuItems: ContextMenuItem[] =
              contextMenu.area === 'header'
                ? contextMenu.items
                : [
                    ...(selectionRange
                      ? [
                          { label: 'Copy selected cells', value: COPY_RANGE_ACTION } as ContextMenuItem,
                          {
                            label: 'Copy selected cells with header',
                            value: COPY_RANGE_WITH_HEADER_ACTION,
                            trailingDivider: true,
                          } as ContextMenuItem,
                        ]
                      : []),
                    ...contextMenu.items,
                  ];
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
