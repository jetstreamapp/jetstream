/* eslint-disable @typescript-eslint/no-explicit-any */
import { Column, Row } from '@tanstack/react-table';
import classNames from 'classnames';
import { CSSProperties, memo } from 'react';
import { RowWithKey } from '../grid-types';
import { GridCell } from './GridCell';

export interface ActiveCell {
  rowId: string;
  columnId: string;
}

export interface GridRowProps<TRow> {
  row: Row<TRow>;
  columns: Column<TRow, unknown>[];
  gridTemplateColumns: string;
  /** Visible leaf-column indexes to render (windowed + always-on frozen). */
  visibleColumnIndexes: number[];
  /** 1-based ARIA row index (header occupies row 1). */
  ariaRowIndex: number;
  /** Index within the filtered/sorted row model (used by renderers + keyboard). */
  rowIndex: number;
  /** Virtualizer translateY offset (px). */
  virtualStart: number;
  /** Pinned row height (px) from the virtualizer. Fixing it keeps vertical layout independent of which
   * columns are windowed, so horizontal scrolling never resizes/reflows rows. */
  height: number;
  activeCell?: ActiveCell | null;
  /** Explicit selection flag so the memo'd row re-renders when selection flips (row refs are stable). */
  isSelected: boolean;
  /** Explicit expanded flag — same reason as `isSelected`: TanStack reuses the Row instance across
   * expand/collapse, so without this prop the memo'd row (and its chevron) never re-renders on toggle. */
  isExpanded: boolean;
  /** True for the last data row — lets its corner cells round to match the table's bottom corners. */
  isLastRow: boolean;
  /** Inclusive column-index range selected on this row (cell range), or null. */
  selectionColRange?: { start: number; end: number } | null;
  rowClass?: (row: TRow) => string | undefined;
  onCellMouseDown?: (rowId: string, columnId: string, shiftKey: boolean, button?: number) => void;
  onCellMouseEnter?: (rowId: string, columnId: string) => void;
  onCellContextMenu?: (event: React.MouseEvent, rowId: string, columnId: string) => void;
  onStartEdit?: (rowId: string, columnId: string) => void;
  onCommitRow?: (updatedRow: TRow, rowId: string, columnId: string) => void;
}

function GridRowComponent<TRow>({
  row,
  columns,
  gridTemplateColumns,
  visibleColumnIndexes,
  ariaRowIndex,
  rowIndex,
  virtualStart,
  height,
  activeCell,
  isSelected,
  isExpanded,
  isLastRow,
  selectionColRange,
  rowClass,
  onCellMouseDown,
  onCellMouseEnter,
  onCellContextMenu,
  onStartEdit,
  onCommitRow,
}: GridRowProps<TRow>) {
  const original = row.original as TRow & Partial<RowWithKey>;
  const consumerRowClass = rowClass?.(row.original);
  const cells = row.getVisibleCells();

  const style: CSSProperties = {
    gridTemplateColumns,
    blockSize: height,
    transform: `translateY(${virtualStart}px)`,
  };

  // ROW colSpan support (e.g. deploy's "No metadata found" message spanning several tracks). Resolve
  // span ownership across ALL columns so it stays stable as the horizontal window moves, then render
  // only the cells that intersect the window. Tables without colSpan take the cheap map below.
  const hasColSpan = columns.some((column) => column.columnDef.meta?.jetstream?.colSpan);
  let renderedCells: React.ReactNode[];
  if (hasColSpan) {
    const visibleIndexSet = new Set(visibleColumnIndexes);
    renderedCells = [];
    let columnIndex = 0;
    while (columnIndex < cells.length) {
      const cell = cells[columnIndex];
      const colSpanFn = cell.column.columnDef.meta?.jetstream?.colSpan;
      const span = Math.max(1, Math.min(colSpanFn?.({ type: 'ROW', row: row.original }) ?? 1, cells.length - columnIndex));
      let intersectsWindow = false;
      for (let track = columnIndex; track < columnIndex + span; track++) {
        if (visibleIndexSet.has(track)) {
          intersectsWindow = true;
          break;
        }
      }
      if (intersectsWindow) {
        renderedCells.push(renderCell(cell, columnIndex, span));
      }
      columnIndex += span;
    }
  } else {
    renderedCells = visibleColumnIndexes.map((columnIndex) => {
      const cell = cells[columnIndex];
      return cell ? renderCell(cell, columnIndex, 1) : null;
    });
  }

  function renderCell(cell: (typeof cells)[number], columnIndex: number, colSpan: number) {
    return (
      <GridCell
        key={cell.id}
        cell={cell}
        columns={columns}
        rowIndex={rowIndex}
        colIndex={columnIndex}
        ariaColIndex={columnIndex + 1}
        colSpan={colSpan}
        isActive={!!activeCell && activeCell.rowId === row.id && activeCell.columnId === cell.column.id}
        isSelected={isSelected}
        rowIsExpanded={isExpanded}
        isRangeSelected={!!selectionColRange && columnIndex >= selectionColRange.start && columnIndex <= selectionColRange.end}
        onCellMouseDown={onCellMouseDown}
        onCellMouseEnter={onCellMouseEnter}
        onCellContextMenu={onCellContextMenu}
        onStartEdit={onStartEdit}
        onCommitRow={onCommitRow}
      />
    );
  }

  return (
    <div
      role="row"
      aria-rowindex={ariaRowIndex}
      aria-level={row.depth > 0 ? row.depth + 1 : undefined}
      aria-expanded={row.getCanExpand() ? isExpanded : undefined}
      aria-selected={row.getCanSelect() ? isSelected : undefined}
      data-row-id={row.id}
      data-index={rowIndex}
      className={classNames('jgrid-row', { 'jgrid-row-selected': isSelected, 'jgrid-row-last': isLastRow }, consumerRowClass, {
        'save-error': !!(original as Partial<RowWithKey>)?._saveError,
      })}
      style={style}
    >
      {renderedCells}
    </div>
  );
}

export const GridRow = memo(GridRowComponent) as typeof GridRowComponent;
