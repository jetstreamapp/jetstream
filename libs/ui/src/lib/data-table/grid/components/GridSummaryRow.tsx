/* eslint-disable @typescript-eslint/no-explicit-any */
import { Column } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties } from 'react';
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
}: GridSummaryRowProps<TRow, TSummaryRow>) {
  const style: CSSProperties = { gridTemplateColumns, ...(height ? { blockSize: height } : {}) };
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
        return (
          <div
            key={column.id}
            role="gridcell"
            className={classNames('jgrid-cell jgrid-summary-cell', dynamicClass)}
            style={{ gridColumnStart: columnIndex + 1, ...getFrozenCellStyle(columns, columnIndex) }}
          >
            {meta?.renderSummaryCell && meta.column ? meta.renderSummaryCell({ row: summaryRow, column: meta.column as any }) : null}
          </div>
        );
      })}
    </div>
  );
}
