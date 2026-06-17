/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table } from '@tanstack/react-table';
import { CSSProperties, ReactNode } from 'react';
import { HEADER_ROW_ID } from '../grid-constants';
import { DataTableHeaderProps } from '../grid-types';
import { ActiveCell } from './GridRow';
import { GridSummaryRow } from './GridSummaryRow';
import { HeaderCell } from './HeaderCell';

export interface GridHeaderProps<TRow, TSummaryRow = unknown> {
  table: Table<TRow>;
  gridTemplateColumns: string;
  /** Visible leaf-column indexes to render (windowed + always-on frozen), keeps header aligned with the body. */
  visibleColumnIndexes: number[];
  renderFilter?: (props: DataTableHeaderProps<TRow>) => ReactNode;
  /** Pinned summary rows rendered below the header (sticky). */
  summaryRows?: TSummaryRow[];
  /** Fixed height (px) per summary row; content-sized when omitted. */
  summaryRowHeight?: number;
  onHeaderContextMenu?: (event: React.MouseEvent, columnId: string) => void;
  /** Active cell — used to drive roving tabindex when the header row is keyboard-focused. */
  activeCell?: ActiveCell | null;
  /** Mouse down on a header cell — makes it the keyboard-active cell. */
  onHeaderCellMouseDown?: (columnId: string) => void;
}

export function GridHeader<TRow, TSummaryRow = unknown>({
  table,
  gridTemplateColumns,
  visibleColumnIndexes,
  renderFilter,
  summaryRows,
  summaryRowHeight,
  onHeaderContextMenu,
  activeCell,
  onHeaderCellMouseDown,
}: GridHeaderProps<TRow, TSummaryRow>) {
  const leafColumns = table.getVisibleLeafColumns();
  const style: CSSProperties = { gridTemplateColumns };
  const visibleIndexSet = new Set(visibleColumnIndexes);
  const activeHeaderColumnId = activeCell?.rowId === HEADER_ROW_ID ? activeCell.columnId : null;

  return (
    <div role="rowgroup" className="jgrid-header">
      {table.getHeaderGroups().map((headerGroup) => {
        // A column may declare a HEADER colSpan (column-group header, e.g. a profile name spanning its
        // Read/Edit sub-columns). Walk ALL columns (not just the visible window) so span ownership is
        // stable — a spanning header must still render when its own track is scrolled out of the window
        // but a column it covers is visible. Only headers intersecting the window are emitted.
        const headerCells: ReactNode[] = [];
        let columnIndex = 0;
        while (columnIndex < headerGroup.headers.length) {
          const header = headerGroup.headers[columnIndex];
          const colSpanFn = header.column.columnDef.meta?.jetstream?.colSpan;
          const span = Math.max(1, Math.min(colSpanFn?.({ type: 'HEADER' }) ?? 1, leafColumns.length - columnIndex));
          let intersectsWindow = false;
          for (let track = columnIndex; track < columnIndex + span; track++) {
            if (visibleIndexSet.has(track)) {
              intersectsWindow = true;
              break;
            }
          }
          if (intersectsWindow) {
            headerCells.push(
              <HeaderCell
                key={header.id}
                header={header}
                colIndex={columnIndex}
                ariaColIndex={columnIndex + 1}
                allColumns={leafColumns}
                colSpan={span}
                renderFilter={renderFilter}
                onHeaderContextMenu={onHeaderContextMenu}
                isActive={activeHeaderColumnId === header.column.id}
                onHeaderCellMouseDown={onHeaderCellMouseDown}
              />,
            );
          }
          columnIndex += span;
        }
        return (
          <div role="row" aria-rowindex={1} className="jgrid-header-row" style={style} key={headerGroup.id}>
            {headerCells}
          </div>
        );
      })}
      {summaryRows?.map((summaryRow, index) => (
        <GridSummaryRow
          key={index}
          summaryRow={summaryRow}
          columns={leafColumns}
          gridTemplateColumns={gridTemplateColumns}
          visibleColumnIndexes={visibleColumnIndexes}
          ariaRowIndex={index + 2}
          height={summaryRowHeight}
        />
      ))}
    </div>
  );
}
