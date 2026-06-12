/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Column } from '@tanstack/react-table';
import { CSSProperties } from 'react';

/** True when a column is pinned/frozen to the left (sticky). */
export function isFrozenColumn<TRow>(column: Column<TRow, unknown>): boolean {
  return !!column.columnDef.meta?.jetstream?.frozen;
}

/** CSS grid template built from the visible leaf columns' current sizes. */
export function getGridTemplateColumns<TRow>(columns: Column<TRow, unknown>[]): string {
  return columns.map((column) => `${column.getSize()}px`).join(' ');
}

/** Cumulative left offset (px) for a frozen column, summing the widths of preceding frozen columns. */
export function getFrozenLeftOffset<TRow>(columns: Column<TRow, unknown>[], targetIndex: number): number {
  let offset = 0;
  for (let index = 0; index < targetIndex; index++) {
    if (isFrozenColumn(columns[index])) {
      offset += columns[index].getSize();
    }
  }
  return offset;
}

/** Sticky-left positioning style for a frozen cell (returns empty object for non-frozen columns). */
export function getFrozenCellStyle<TRow>(columns: Column<TRow, unknown>[], index: number): CSSProperties {
  if (!isFrozenColumn(columns[index])) {
    return {};
  }
  return {
    position: 'sticky',
    left: getFrozenLeftOffset(columns, index),
    zIndex: 1,
  };
}
