/* eslint-disable @typescript-eslint/no-explicit-any */
import { IconName } from '@jetstream/icon-factory';
import { Header } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties, ReactNode, useId } from 'react';
import Checkbox from '../../../form/checkbox/Checkbox';
import Icon from '../../../widgets/Icon';
import { HeaderFilterButton } from '../filters/HeaderFilters';
import { DEFAULT_MIN_COLUMN_WIDTH } from '../grid-constants';
import { DataTableHeaderProps, SortDirection } from '../grid-types';
import { getFrozenCellStyle } from './grid-layout';

export interface HeaderCellProps<TRow> {
  header: Header<TRow, unknown>;
  colIndex: number;
  ariaColIndex: number;
  allColumns: Header<TRow, unknown>['column'][];
  /** Number of leaf columns this header spans (column-group header). Defaults to 1. */
  colSpan?: number;
  /** Slot for the header filter popover trigger (wired in phase 3). */
  renderFilter?: (props: DataTableHeaderProps<TRow>) => ReactNode;
  /** Right-click on the header — offers the column-scoped copy actions when the table has a context menu. */
  onHeaderContextMenu?: (event: React.MouseEvent, columnId: string) => void;
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

export function HeaderCell<TRow>({
  header,
  colIndex,
  ariaColIndex,
  allColumns,
  colSpan = 1,
  renderFilter,
  onHeaderContextMenu,
}: HeaderCellProps<TRow>) {
  const selectAllId = useId();
  const meta = header.column.columnDef.meta?.jetstream;
  const column = meta?.column;
  const sorted = header.column.getIsSorted();
  const canSort = header.column.getCanSort();
  const canResize = header.column.getCanResize();
  const table = header.getContext().table;
  const isResizing = header.column.getIsResizing();

  // With `columnResizeMode: 'onEnd'` the column keeps its width during the drag; only this handle
  // (and its full-height ::after guide line) follows the cursor, clamped to the column's min/max so
  // the guide never suggests a width the release won't honor. Widths apply once on mouse release.
  let resizeIndicatorStyle: CSSProperties | undefined;
  if (isResizing) {
    const { deltaOffset, startSize } = table.getState().columnSizingInfo;
    const currentSize = startSize ?? header.column.getSize();
    const minDelta = (header.column.columnDef.minSize ?? DEFAULT_MIN_COLUMN_WIDTH) - currentSize;
    const maxDelta = (header.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER) - currentSize;
    resizeIndicatorStyle = { transform: `translateX(${Math.min(Math.max(deltaOffset ?? 0, minDelta), maxDelta)}px)` };
  }
  // 1-based sort priority, shown only when more than one column participates in the sort.
  const sortPriority = sorted && table.getState().sorting.length > 1 ? header.column.getSortIndex() + 1 : undefined;

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
        <Checkbox
          id={selectAllId}
          label="Select all rows"
          hideLabel
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={(checked) => table.toggleAllRowsSelected(checked)}
        />
      </span>
    );
  }

  return (
    <div
      role="columnheader"
      aria-colindex={ariaColIndex}
      aria-sort={canSort ? toAriaSort(sorted) : undefined}
      data-col-id={header.column.id}
      className={classNames('jgrid-header-cell', { 'jgrid-cell-frozen': meta?.frozen, 'jgrid-header-sortable': canSort })}
      style={style}
      tabIndex={-1}
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
          {renderFilter && headerProps ? renderFilter(headerProps) : <HeaderFilterButton columnKey={column.key} />}
        </span>
      ) : null}

      {canResize && (
        <span
          role="presentation"
          className={classNames('jgrid-header-resize-handle', { 'jgrid-resizing': isResizing })}
          style={resizeIndicatorStyle}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={() => header.column.resetSize()}
        />
      )}
    </div>
  );
}
