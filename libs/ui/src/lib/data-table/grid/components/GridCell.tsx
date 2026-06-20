/* eslint-disable @typescript-eslint/no-explicit-any */
import { Cell, Column } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties, memo } from 'react';
import { DataTableCellProps } from '../grid-types';
import { getFrozenCellStyle } from './grid-layout';

export interface GridCellProps<TRow> {
  cell: Cell<TRow, unknown>;
  /** Visible leaf columns (for frozen offset math). */
  columns: Column<TRow, unknown>[];
  rowIndex: number;
  colIndex: number;
  /** 1-based ARIA column index. */
  ariaColIndex: number;
  /** Number of grid tracks this cell spans (ROW colSpan). Defaults to 1. */
  colSpan?: number;
  /** Roving tabindex: only the active cell is focusable in navigation mode (phase 5). */
  isActive: boolean;
  /** Explicit selection flag so memo'd cells re-render when selection flips (row refs are stable). */
  isSelected: boolean;
  /** Explicit expanded flag (tree rows). Same rationale as `isSelected`: the Row instance is stable
   * across expand/collapse, so the memo needs this prop to re-render the chevron on toggle. */
  rowIsExpanded?: boolean;
  /** True when this cell is inside the rectangular cell-selection. */
  isRangeSelected: boolean;
  onCellMouseDown?: (rowId: string, columnId: string, shiftKey: boolean, button?: number) => void;
  onCellMouseEnter?: (rowId: string, columnId: string) => void;
  onCellContextMenu?: (event: React.MouseEvent, rowId: string, columnId: string) => void;
  onStartEdit?: (rowId: string, columnId: string) => void;
  /** Commit an in-cell edit (e.g. a checkbox renderer) without opening the popover editor. */
  onCommitRow?: (updatedRow: TRow, rowId: string, columnId: string) => void;
}

function GridCellComponent<TRow>({
  cell,
  columns,
  rowIndex,
  colIndex,
  ariaColIndex,
  colSpan = 1,
  isActive,
  isSelected,
  rowIsExpanded,
  isRangeSelected,
  onCellMouseDown,
  onCellMouseEnter,
  onCellContextMenu,
  onStartEdit,
  onCommitRow,
}: GridCellProps<TRow>) {
  const meta = cell.column.columnDef.meta?.jetstream;
  const column = meta?.column;
  const row = cell.row.original;
  const value = cell.getValue();

  const cellKind = meta?.cellKind ?? 'data';
  const role = cellKind === 'rowheader' ? 'rowheader' : 'gridcell';

  const dynamicClass = typeof meta?.cellClass === 'function' ? meta.cellClass(row) : meta?.cellClass;

  // `editable` may be a per-row predicate, so resolve it against this row before announcing read-only.
  const editable = meta?.editable;
  const isEditable = typeof editable === 'function' ? editable(row) : !!editable;

  const style: CSSProperties = {
    ...(colSpan > 1 ? { gridColumn: `${colIndex + 1} / span ${colSpan}` } : { gridColumnStart: colIndex + 1 }),
    ...getFrozenCellStyle(columns, colIndex),
  };

  let content: React.ReactNode;
  // A custom renderCell wins even on the select column — consumers override it to suppress the
  // checkbox for placeholder rows (e.g. deploy's "No metadata found" rows). The built-in checkbox is
  // the fallback for bare select columns.
  if (cellKind === 'select' && !column?.renderCell) {
    content = (
      <span className="jgrid-cell-select slds-grid slds-grid_align-center slds-grid_vertical-align-center">
        <input
          type="checkbox"
          aria-label="Select row"
          tabIndex={-1}
          checked={isSelected}
          disabled={!cell.row.getCanSelect()}
          onChange={cell.row.getToggleSelectedHandler()}
          onClick={(event) => event.stopPropagation()}
        />
      </span>
    );
  } else if (column?.renderCell) {
    const canExpand = cell.row.getCanExpand();
    const renderProps: DataTableCellProps<TRow> = {
      row,
      column,
      value,
      rowIndex,
      rowIdx: rowIndex,
      tanstackRow: cell.row,
      depth: cell.row.depth,
      canExpand,
      // Prefer the explicit prop (kept fresh by GridBody) so the chevron re-renders on toggle; fall
      // back to the row for any caller that renders GridCell without threading the flag.
      isExpanded: canExpand && (rowIsExpanded ?? cell.row.getIsExpanded()),
      toggleExpanded: () => canExpand && cell.row.toggleExpanded(),
      isEditing: false,
      startEdit: () => onStartEdit?.(cell.row.id, cell.column.id),
      commitEdit: (updatedRow) => onCommitRow?.(updatedRow, cell.row.id, cell.column.id),
      cancelEdit: () => undefined,
    };
    content = column.renderCell(renderProps);
  } else {
    content = value === null || value === undefined ? '' : String(value);
  }

  return (
    <div
      role={role}
      data-row-id={cell.row.id}
      data-col-id={cell.column.id}
      aria-colindex={ariaColIndex}
      aria-readonly={isEditable ? undefined : true}
      aria-selected={isRangeSelected || undefined}
      tabIndex={isActive ? 0 : -1}
      className={classNames(
        'jgrid-cell',
        `jgrid-cell-kind-${cellKind}`,
        {
          'jgrid-cell-frozen': meta?.frozen,
          'jgrid-cell-range': isRangeSelected,
          // Edge markers so a focused corner cell can round its focus ring to match the table corners.
          'jgrid-cell-col-first': colIndex === 0,
          'jgrid-cell-col-last': colIndex + colSpan >= columns.length,
        },
        dynamicClass,
      )}
      style={style}
      onMouseDown={(event) => onCellMouseDown?.(cell.row.id, cell.column.id, event.shiftKey, event.button)}
      onMouseEnter={() => onCellMouseEnter?.(cell.row.id, cell.column.id)}
      onContextMenu={(event) => onCellContextMenu?.(event, cell.row.id, cell.column.id)}
      onDoubleClick={() => onStartEdit?.(cell.row.id, cell.column.id)}
    >
      {content}
    </div>
  );
}

export const GridCell = memo(GridCellComponent) as typeof GridCellComponent;
