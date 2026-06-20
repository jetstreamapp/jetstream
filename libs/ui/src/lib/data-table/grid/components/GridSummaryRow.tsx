/* eslint-disable @typescript-eslint/no-explicit-any */
import { Column } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties } from 'react';
import { ActiveCell } from './GridRow';
import { getFrozenCellStyle } from './grid-layout';

export interface GridSummaryRowProps<TRow, TSummaryRow> {
  summaryRow: TSummaryRow;
  columns: Column<TRow, unknown>[];
  gridTemplateColumns: string;
  /** Visible leaf-column indexes to render (windowed + always-on frozen). */
  visibleColumnIndexes: number[];
  ariaRowIndex: number;
  /** Fixed row height (px); content-sized when omitted. */
  height?: number;
  /** Sentinel row id for the keyboard-navigation model (see `getSummaryRowId`). */
  rowId: string;
  /** Active cell — drives this row's roving tabindex so arrows can land on a summary cell. */
  activeCell?: ActiveCell | null;
  /** Mouse down on a summary cell — makes it the keyboard-active cell so arrow nav continues from here. */
  onSummaryCellMouseDown?: (rowId: string, columnId: string) => void;
}

/**
 * A pinned summary row rendered inside the sticky header block. Each column may supply
 * `renderSummaryCell` (e.g. select-all / reset column actions, aggregates). Full content freedom —
 * the legacy grid faked these through react-data-grid's constrained summary mechanism.
 */
export function GridSummaryRow<TRow, TSummaryRow>({
  summaryRow,
  columns,
  gridTemplateColumns,
  visibleColumnIndexes,
  ariaRowIndex,
  height,
  rowId,
  activeCell,
  onSummaryCellMouseDown,
}: GridSummaryRowProps<TRow, TSummaryRow>) {
  const style: CSSProperties = { gridTemplateColumns, ...(height ? { blockSize: height } : {}) };
  const activeColumnId = activeCell?.rowId === rowId ? activeCell.columnId : null;
  return (
    <div role="row" aria-rowindex={ariaRowIndex} className="jgrid-summary-row" style={style}>
      {visibleColumnIndexes.map((columnIndex) => {
        const column = columns[columnIndex];
        if (!column) {
          return null;
        }
        const meta = column.columnDef.meta?.jetstream;
        const summaryCellClass = meta?.column?.summaryCellClass;
        const dynamicClass = typeof summaryCellClass === 'function' ? summaryCellClass(summaryRow as any) : summaryCellClass;
        const isActive = activeColumnId === column.id;
        return (
          <div
            key={column.id}
            role="gridcell"
            data-row-id={rowId}
            data-col-id={column.id}
            tabIndex={isActive ? 0 : -1}
            className={classNames('jgrid-cell jgrid-summary-cell', dynamicClass)}
            style={{ gridColumnStart: columnIndex + 1, ...getFrozenCellStyle(columns, columnIndex) }}
            onMouseDown={() => onSummaryCellMouseDown?.(rowId, column.id)}
          >
            {meta?.renderSummaryCell && meta.column ? meta.renderSummaryCell({ row: summaryRow, column: meta.column as any }) : null}
          </div>
        );
      })}
    </div>
  );
}
