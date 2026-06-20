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
import { ColumnWithFilter, ContextMenuActionData, DataTableHeaderProps, RowWithKey } from '../grid-types';
import { useGridKeyboardNavigation } from '../keyboard/useGridKeyboardNavigation';
import { GridBody, RowHeightFn } from './GridBody';
import { GridHeader } from './GridHeader';
import { ActiveCell } from './GridRow';
import { getGridTemplateColumns } from './grid-layout';

const COPY_RANGE_ACTION = '__COPY_RANGE__';

/** Context-menu actions that operate on a column/table (no specific row) — the subset offered when
 * right-clicking a column HEADER. Matches the `ContextAction` values used by the standard
 * TABLE_CONTEXT_MENU_ITEMS; consumer items outside this set are cell-scoped and excluded. */
const COLUMN_SCOPED_CONTEXT_ACTIONS = new Set<unknown>([
  'COPY_COL',
  'COPY_COL_JSON',
  'COPY_COL_NO_HEADER',
  'COPY_TABLE',
  'COPY_TABLE_JSON',
]);

interface ContextMenuState {
  area: 'cell' | 'header';
  /** Set for cell menus; absent for header menus. */
  rowId?: string;
  columnId: string;
  element: HTMLElement;
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
  /** Right-click context menu items (must be stable). */
  contextMenuItems?: ContextMenuItem[];
  /** Right-click context menu action handler (must be stable). */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<TRow>) => void;
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
  children,
}: GridContainerProps<TRow>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [editingCell, setEditingCell] = useState<ActiveCell | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
  });

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

  const hasContextMenu = !!contextMenuItems && !!contextMenuAction;
  const handleCellContextMenu = useCallback(
    (event: React.MouseEvent, rowId: string, columnId: string) => {
      // Ctrl/Meta lets the native browser menu through; only intercept when we have something to show.
      if (event.ctrlKey || event.metaKey || (!hasContextMenu && !selectionRange)) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      // Re-open on the next tick so an already-open menu closes first (matches legacy behavior).
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'cell', rowId, columnId, element }));
    },
    [hasContextMenu, selectionRange],
  );

  // Right-clicking a column HEADER offers the column/table-scoped copy actions (when this table has a
  // context menu at all). Non-data columns (select/action) keep the native menu.
  const headerContextMenuItems = useMemo(
    () => (hasContextMenu ? (contextMenuItems ?? []).filter((item) => COLUMN_SCOPED_CONTEXT_ACTIONS.has(item.value)) : []),
    [hasContextMenu, contextMenuItems],
  );
  const handleHeaderContextMenu = useCallback(
    (event: React.MouseEvent, columnId: string) => {
      if (event.ctrlKey || event.metaKey || !headerContextMenuItems.length || NON_DATA_COLUMN_KEYS.has(columnId)) {
        return;
      }
      event.preventDefault();
      const element = event.currentTarget as HTMLElement;
      setContextMenu(null);
      setTimeout(() => setContextMenu({ area: 'header', columnId, element }));
    },
    [headerContextMenuItems],
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
            aria-label={ariaLabel}
            aria-rowcount={rowCount + 1}
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
            const isHeaderMenu = contextMenu.area === 'header';
            const menuItems: ContextMenuItem[] = isHeaderMenu
              ? headerContextMenuItems
              : [
                  ...(selectionRange
                    ? [{ label: 'Copy selected cells', value: COPY_RANGE_ACTION, trailingDivider: true } as ContextMenuItem]
                    : []),
                  ...(contextMenuItems ?? []),
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
                  } else if (contextMenuAction) {
                    // Consumers receive only data (leaf) rows — group rows would duplicate each
                    // group's first child, and collapsed groups must still be copyable.
                    const leafRows = getSortedFilteredLeafRows(table);
                    const rowIndex = isHeaderMenu ? 0 : leafRows.findIndex((modelRow) => modelRow.id === contextMenu.rowId);
                    const column = table.getColumn(contextMenu.columnId)?.columnDef.meta?.jetstream?.column;
                    if (rowIndex >= 0 && rowIndex < leafRows.length && column) {
                      contextMenuAction(item, {
                        row: leafRows[rowIndex].original,
                        rows: leafRows.map((modelRow) => modelRow.original),
                        rowIdx: rowIndex,
                        column,
                        columns: orderedColumns,
                      });
                    }
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
