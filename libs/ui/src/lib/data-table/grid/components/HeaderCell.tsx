/* eslint-disable @typescript-eslint/no-explicit-any */
import { IconName } from '@jetstream/icon-factory';
import { useSelector } from '@tanstack/react-store';
import { Subscribe } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties, ReactNode, useId, useState } from 'react';
import Checkbox from '../../../form/checkbox/Checkbox';
import Icon from '../../../widgets/Icon';
import { HeaderFilterButton } from '../filters/HeaderFilters';
import { DEFAULT_MIN_COLUMN_WIDTH, HEADER_ROW_ID } from '../grid-constants';
import { DataTableHeaderProps, SortDirection, TanstackHeader } from '../grid-types';
import { getFrozenCellStyle } from './grid-layout';

export interface HeaderCellProps<TRow extends object> {
  header: TanstackHeader<TRow>;
  colIndex: number;
  ariaColIndex: number;
  allColumns: TanstackHeader<TRow>['column'][];
  /** Number of leaf columns this header spans (column-group header). Defaults to 1. */
  colSpan?: number;
  /** Slot for the header filter popover trigger (wired in phase 3). */
  renderFilter?: (props: DataTableHeaderProps<TRow>) => ReactNode;
  /** Right-click on the header — offers the column-scoped copy actions when the table has a context menu. */
  onHeaderContextMenu?: (event: React.MouseEvent, columnId: string) => void;
  /** True when this header cell is the keyboard-active cell (header row navigation). Drives roving tabindex. */
  isActive?: boolean;
  /** Mouse down on a header cell — makes it the keyboard-active cell so arrow nav continues from here. */
  onHeaderCellMouseDown?: (columnId: string) => void;
  /** Column id currently being dragged (column reorder), or null. Drives the source's dimmed style. */
  draggingColumnId?: string | null;
  /** Drag of this header started — owner tracks the dragged column id. */
  onColumnDragStart?: (columnId: string) => void;
  /** Drag ended (drop or cancel) — owner clears the dragged column id. */
  onColumnDragEnd?: () => void;
  /** A column was dropped onto this header — owner applies the new column order. */
  onColumnReorder?: (sourceColumnId: string, targetColumnId: string, side: 'left' | 'right') => void;
}

function toAriaSort(sorted: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (sorted === 'asc') {
    return 'ascending';
  }
  if (sorted === 'desc') {
    return 'descending';
  }
  return 'none';
}

export function HeaderCell<TRow extends object>({
  header,
  colIndex,
  ariaColIndex,
  allColumns,
  colSpan = 1,
  renderFilter,
  onHeaderContextMenu,
  isActive = false,
  onHeaderCellMouseDown,
  draggingColumnId,
  onColumnDragStart,
  onColumnDragEnd,
  onColumnReorder,
}: HeaderCellProps<TRow>) {
  const selectAllId = useId();
  const meta = header.column.columnDef.meta?.jetstream;
  const column = meta?.column;
  const sorted = header.column.getIsSorted();
  const canSort = header.column.getCanSort();
  const canResize = header.column.getCanResize();
  const table = header.getContext().table;

  // The header row is memoized, so a sort click doesn't re-render it from above — this cell re-renders
  // itself when ITS slice of the sort state changes (direction or 1-based priority; the projection is a
  // compact string so unaffected columns stay quiet). The render logic below still reads the pull-based
  // getters, which are always fresh; this subscription only schedules the re-render.
  useSelector(table.atoms.sorting, (sortingState) => {
    const sortIndex = sortingState.findIndex((sort) => sort.id === header.column.id);
    if (sortIndex === -1) {
      return 'none';
    }
    return `${sortingState[sortIndex].desc ? 'desc' : 'asc'}:${sortingState.length > 1 ? sortIndex + 1 : 0}`;
  });

  // Column reorder (drag-and-drop). Only data columns that opted in and are not pinned can be moved or
  // can receive a drop. The reorder pipeline is wired through the owner (GridContainer → table.setColumnOrder).
  const canReorder = !!column?.draggable && meta?.cellKind === 'data' && !meta?.frozen && !!onColumnReorder;
  const isDraggingThis = !!draggingColumnId && draggingColumnId === header.column.id;
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null);
  // The resize handle lives inside this (draggable) cell, so a drag gesture starting on the handle would
  // otherwise pick the cell as the native drag source — initiating a column reorder instead of a resize.
  // While the pointer is over the handle we drop `draggable` so the mousedown can only start a resize.
  const [isOverResizeHandle, setIsOverResizeHandle] = useState(false);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    // Belt-and-suspenders: never let an in-progress resize turn into a column drag.
    if (isOverResizeHandle || header.column.getIsResizing()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', header.column.id);
    event.dataTransfer.effectAllowed = 'move';
    onColumnDragStart?.(header.column.id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    // Only react while a column drag is in progress and this column isn't the source.
    if (!draggingColumnId || draggingColumnId === header.column.id) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    setDropSide(event.clientX < rect.left + rect.width / 2 ? 'left' : 'right');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    // Ignore leave events that merely cross into a child element of this cell.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDropSide(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceColumnId = event.dataTransfer.getData('text/plain');
    const side = dropSide ?? 'left';
    setDropSide(null);
    if (sourceColumnId && sourceColumnId !== header.column.id) {
      onColumnReorder?.(sourceColumnId, header.column.id, side);
    }
  };

  // 1-based sort priority, shown only when more than one column participates in the sort.
  const sortPriority = sorted && table.store.state.sorting.length > 1 ? header.column.getSortIndex() + 1 : undefined;

  const headerProps: DataTableHeaderProps<TRow> | undefined = column
    ? {
        column,
        header,
        sortDirection: sorted ? ((sorted === 'asc' ? 'ASC' : 'DESC') as SortDirection) : undefined,
        priority: sortPriority,
      }
    : undefined;

  const style: CSSProperties = {
    gridColumn: colSpan > 1 ? `${colIndex + 1} / span ${colSpan}` : `${colIndex + 1}`,
    ...getFrozenCellStyle(allColumns, colIndex),
  };

  let label: ReactNode = column && column.renderHeaderCell && headerProps ? column.renderHeaderCell(headerProps) : (column?.name ?? null);

  // Built-in select-all checkbox for the row-selection column (parity with react-data-grid's
  // SelectColumn header) unless the author supplied their own header content.
  if (meta?.cellKind === 'select' && !column?.renderHeaderCell && table.options.enableRowSelection) {
    label = (
      <span
        className="jgrid-cell-select slds-grid slds-grid_align-center slds-grid_vertical-align-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Island: the memoized header row skips selection/filter re-renders, so the select-all
            checkbox subscribes itself. Filter slices are included because all/some-selected are
            evaluated against the FILTERED row model — without them the checkbox would go stale while
            quick-filtering under an active selection. (Data swaps re-render this too: the filter
            reducer re-INITs on data change, giving columnFilters a fresh identity.) */}
        <Subscribe
          source={table.store}
          selector={(state) => ({
            rowSelection: state.rowSelection,
            columnFilters: state.columnFilters,
            globalFilter: state.globalFilter,
          })}
        >
          {() => {
            const allSelected = table.getIsAllRowsSelected();
            return (
              <Checkbox
                id={selectAllId}
                label="Select all rows"
                hideLabel
                // Keep out of the page tab order — the grid is a single tab stop and the header row is
                // reached via roving tabindex; Enter/Space on the select-all header cell toggles this.
                tabIndex={-1}
                checked={allSelected}
                // v9 semantic change: getIsSomeRowsSelected() stays true when ALL rows are selected, so
                // gate the indeterminate visual or the checkbox never reaches the checked look.
                indeterminate={!allSelected && table.getIsSomeRowsSelected()}
                onChange={(checked) => table.toggleAllRowsSelected(checked)}
              />
            );
          }}
        </Subscribe>
      </span>
    );
  }

  return (
    <div
      role="columnheader"
      aria-colindex={ariaColIndex}
      aria-sort={canSort ? toAriaSort(sorted) : undefined}
      data-row-id={HEADER_ROW_ID}
      data-col-id={header.column.id}
      className={classNames('jgrid-header-cell', {
        'jgrid-cell-frozen': meta?.frozen,
        // Center the select-all checkbox; its label wrapper shrink-wraps, so the cell must do the centering.
        'jgrid-header-cell-select': meta?.cellKind === 'select',
        'jgrid-header-sortable': canSort,
        'jgrid-header-draggable': canReorder,
        'jgrid-header-dragging': isDraggingThis,
        'jgrid-drop-before': dropSide === 'left',
        'jgrid-drop-after': dropSide === 'right',
        // Edge markers so the corner header cells round to match the table's top corners.
        'jgrid-cell-col-first': colIndex === 0,
        'jgrid-cell-col-last': colIndex + colSpan >= allColumns.length,
      })}
      style={style}
      tabIndex={isActive ? 0 : -1}
      draggable={canReorder && !isOverResizeHandle}
      onDragStart={canReorder ? handleDragStart : undefined}
      onDragEnd={canReorder ? () => onColumnDragEnd?.() : undefined}
      onDragOver={canReorder ? handleDragOver : undefined}
      onDragLeave={canReorder ? handleDragLeave : undefined}
      onDrop={canReorder ? handleDrop : undefined}
      onMouseDown={() => onHeaderCellMouseDown?.(header.column.id)}
      onContextMenu={(event) => onHeaderContextMenu?.(event, header.column.id)}
    >
      {canSort ? (
        <button
          type="button"
          className="jgrid-header-sort-button slds-button_reset slds-grid slds-grid_vertical-align-center"
          onClick={header.column.getToggleSortingHandler()}
          tabIndex={-1}
          title={typeof column?.name === 'string' ? column.name : undefined}
        >
          <span className="slds-truncate jgrid-header-label">{label}</span>
          {sorted && (
            <span className="jgrid-header-sort-indicator slds-grid slds-grid_vertical-align-center">
              <Icon
                type="utility"
                icon={(sorted === 'asc' ? 'arrowup' : 'arrowdown') as IconName}
                className="slds-icon slds-icon-text-default slds-icon_xx-small"
              />
              {sortPriority && <span className="jgrid-sort-priority">{sortPriority}</span>}
            </span>
          )}
        </button>
      ) : (
        <span className="slds-truncate jgrid-header-label">{label}</span>
      )}

      {column?.filters?.length ? (
        <span className="jgrid-header-filter-slot" onClick={(event) => event.stopPropagation()}>
          {renderFilter && headerProps ? (
            renderFilter(headerProps)
          ) : (
            <HeaderFilterButton columnKey={column.key} columnName={typeof column.name === 'string' ? column.name : undefined} />
          )}
        </span>
      ) : null}

      {canResize && (
        // Fine-grained island: during a drag only THIS column's handle re-renders (per rAF-coalesced
        // mousemove); every other HeaderCell projects `null` and stays quiet. The hook owner opts out
        // of store re-renders entirely, so this subscription is the resize guide's only render source.
        <Subscribe
          source={table.atoms.columnResizing}
          selector={(resizing) =>
            resizing.isResizingColumn === header.column.id ? { deltaOffset: resizing.deltaOffset, startSize: resizing.startSize } : null
          }
        >
          {(activeResize) => {
            // With `columnResizeMode: 'onEnd'` the column keeps its width during the drag; only this
            // handle (and its full-height ::after guide line) follows the cursor, clamped to the
            // column's min/max so the guide never suggests a width the release won't honor.
            let resizeIndicatorStyle: CSSProperties | undefined;
            if (activeResize) {
              const currentSize = activeResize.startSize ?? header.column.getSize();
              const minDelta = (header.column.columnDef.minSize ?? DEFAULT_MIN_COLUMN_WIDTH) - currentSize;
              const maxDelta = (header.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER) - currentSize;
              resizeIndicatorStyle = {
                transform: `translateX(${Math.min(Math.max(activeResize.deltaOffset ?? 0, minDelta), maxDelta)}px)`,
              };
            }
            return (
              <span
                role="presentation"
                // Not draggable, and while hovered the parent cell drops `draggable` too (see
                // isOverResizeHandle), so a resize drag can never initiate a column reorder.
                draggable={false}
                className={classNames('jgrid-header-resize-handle', { 'jgrid-resizing': !!activeResize })}
                style={resizeIndicatorStyle}
                onMouseEnter={() => setIsOverResizeHandle(true)}
                onMouseLeave={() => setIsOverResizeHandle(false)}
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={() => header.column.resetSize()}
              />
            );
          }}
        </Subscribe>
      )}
    </div>
  );
}
