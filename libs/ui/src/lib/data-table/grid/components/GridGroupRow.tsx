/* eslint-disable @typescript-eslint/no-explicit-any */
import { Column, Row } from '@tanstack/react-table';
import { CSSProperties } from 'react';
import Icon from '../../../widgets/Icon';
import { DataTableGroupCellProps } from '../grid-types';
import { ActiveCell } from './GridRow';
import { getFrozenCellStyle } from './grid-layout';

export interface GridGroupRowProps<TRow> {
  row: Row<TRow>;
  columns: Column<TRow, unknown>[];
  gridTemplateColumns: string;
  /** Visible leaf-column indexes to render (windowed + always-on frozen). */
  visibleColumnIndexes: number[];
  ariaRowIndex: number;
  rowIndex: number;
  virtualStart: number;
  /** Pinned row height (px) from the virtualizer (see GridRow). */
  height: number;
  activeCell?: ActiveCell | null;
  onCellMouseDown?: (rowId: string, columnId: string, shiftKey: boolean, button?: number) => void;
}

// `row.getLeafRows()` walks + maps the entire group on every call; cache per TanStack row instance
// (instances are recreated whenever the row model recomputes, so the cache can never go stale).
const childRowsCache = new WeakMap<object, unknown[]>();

function getChildRows<TRow>(row: Row<TRow>): TRow[] {
  let cached = childRowsCache.get(row);
  if (!cached) {
    cached = row.getLeafRows().map((leaf) => leaf.original);
    childRowsCache.set(row, cached);
  }
  return cached as TRow[];
}

/**
 * A group header row. Unlike react-data-grid's tree (which limited what group cells could render),
 * this is just a `role=row` of cells we render ourselves: each column may supply `renderGroupCell`
 * (honoring `colSpan`), or — when no column does — we fall back to a single full-width header with a
 * chevron, the grouping value, and the child count. This is the flexibility the rewrite was for.
 */
export function GridGroupRow<TRow>({
  row,
  columns,
  gridTemplateColumns,
  visibleColumnIndexes,
  ariaRowIndex,
  rowIndex,
  virtualStart,
  height,
  activeCell,
  onCellMouseDown,
}: GridGroupRowProps<TRow>) {
  const isExpanded = row.getIsExpanded();
  const firstColumnId = columns[0]?.id;
  const isActive = !!activeCell && activeCell.rowId === row.id;
  const groupValue = row.groupingValue;
  const childRows = getChildRows(row);
  const toggleGroup = () => row.toggleExpanded();
  const chevron = (
    <Icon
      type="utility"
      icon={isExpanded ? 'chevrondown' : 'chevronright'}
      className="slds-icon slds-icon-text-default slds-icon_x-small slds-m-right_xx-small"
    />
  );

  const rowStyle: CSSProperties = { transform: `translateY(${virtualStart}px)`, blockSize: height, gridTemplateColumns };
  const anyGroupCell = columns.some((column) => column.columnDef.meta?.jetstream?.renderGroupCell);

  const baseRowProps = {
    role: 'row' as const,
    'aria-rowindex': ariaRowIndex,
    'aria-level': (row.depth ?? 0) + 1,
    'aria-expanded': isExpanded,
    'data-row-id': row.id,
    'data-index': rowIndex,
    className: 'jgrid-group-row',
  };

  // Fallback: single full-width group header.
  if (!anyGroupCell) {
    return (
      <div {...baseRowProps} style={{ ...rowStyle, gridTemplateColumns: '1fr' }}>
        <div
          role="gridcell"
          className="jgrid-cell jgrid-group-cell"
          data-row-id={row.id}
          data-col-id={firstColumnId}
          tabIndex={isActive ? 0 : -1}
          onMouseDown={(event) => firstColumnId && onCellMouseDown?.(row.id, firstColumnId, event.shiftKey, event.button)}
        >
          <button
            type="button"
            className="jgrid-group-toggle slds-button_reset slds-grid slds-grid_vertical-align-center"
            onClick={toggleGroup}
            tabIndex={-1}
          >
            {chevron}
            <span className="jgrid-group-toggle-label">{groupValue === null || groupValue === undefined ? '—' : String(groupValue)}</span>
            <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">({childRows.length})</span>
          </button>
        </div>
      </div>
    );
  }

  // Per-column group cells, honoring colSpan. We walk every column to keep the running `startCol`
  // (grid track) accumulation correct, but only render the cells that intersect the visible window.
  const representativeRow = childRows[0];
  const visibleIndexSet = new Set(visibleColumnIndexes);
  const cells: React.ReactNode[] = [];
  let startCol = 1;
  let index = 0;
  while (index < columns.length) {
    const column = columns[index];
    const meta = column.columnDef.meta?.jetstream;
    // Group rows resolve span via the GROUP discriminant so a column can span the header (e.g. the
    // grouping column owning the toggle + label) without widening that column on data rows. Clamp to the
    // remaining tracks so an over-large span can't overrun the row.
    const requestedSpan = meta?.colSpan?.({ type: 'GROUP', row: representativeRow }) ?? 1;
    const span = Math.max(1, Math.min(requestedSpan, columns.length - index));
    // A spanning cell is visible when any of the tracks it covers is in the visible window.
    let cellIsVisible = false;
    for (let track = index; track < index + span; track++) {
      if (visibleIndexSet.has(track)) {
        cellIsVisible = true;
        break;
      }
    }
    if (cellIsVisible) {
      const groupCellProps: DataTableGroupCellProps<TRow> | null = meta?.column
        ? { groupKey: groupValue, childRows, isExpanded, toggleGroup, column: meta.column, tanstackRow: row }
        : null;
      cells.push(
        <div
          key={column.id}
          role="gridcell"
          className="jgrid-cell jgrid-group-cell"
          data-row-id={row.id}
          data-col-id={column.id}
          tabIndex={isActive && activeCell?.columnId === column.id ? 0 : -1}
          onMouseDown={(event) => onCellMouseDown?.(row.id, column.id, event.shiftKey, event.button)}
          style={{ gridColumn: `${startCol} / span ${span}`, ...getFrozenCellStyle(columns, index) }}
        >
          {meta?.renderGroupCell && groupCellProps ? meta.renderGroupCell(groupCellProps) : null}
        </div>,
      );
    }
    startCol += span;
    index += span;
  }

  return (
    <div {...baseRowProps} style={rowStyle}>
      {cells}
    </div>
  );
}
