/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSProperties } from 'react';
import type { TanstackColumn } from '../grid-types';

/** True when a column is pinned/frozen to the left (sticky). */
export function isFrozenColumn<TRow extends object>(column: TanstackColumn<TRow>): boolean {
  return !!column.columnDef.meta?.jetstream?.frozen;
}

/** CSS grid template built from the visible leaf columns' current sizes. */
export function getGridTemplateColumns<TRow extends object>(columns: TanstackColumn<TRow>[]): string {
  return columns.map((column) => `${column.getSize()}px`).join(' ');
}

/** Cumulative left offset (px) for a frozen column, summing the widths of preceding frozen columns. */
export function getFrozenLeftOffset<TRow extends object>(columns: TanstackColumn<TRow>[], targetIndex: number): number {
  let offset = 0;
  for (let index = 0; index < targetIndex; index++) {
    if (isFrozenColumn(columns[index])) {
      offset += columns[index].getSize();
    }
  }
  return offset;
}

/** Sticky-left positioning style for a frozen cell (returns empty object for non-frozen columns). */
export function getFrozenCellStyle<TRow extends object>(columns: TanstackColumn<TRow>[], index: number): CSSProperties {
  if (!isFrozenColumn(columns[index])) {
    return {};
  }
  return {
    position: 'sticky',
    left: getFrozenLeftOffset(columns, index),
    zIndex: 1,
  };
}

/**
 * Sticky-left style for a GROUP row cell, which spans columns and so can straddle the frozen band.
 * A group cell is pinned when its span covers ANY frozen column, not only when its own column is
 * frozen: the permission manager's field table starts the expand/collapse cell on a scrollable column
 * and spans it across the two pinned ones, so without this the toggle scrolls away underneath the
 * frozen cells (which paint above it) and the group becomes impossible to collapse when scrolled right.
 */
export function getGroupCellStickyStyle<TRow extends object>(columns: TanstackColumn<TRow>[], index: number, span: number): CSSProperties {
  const spansFrozenColumn = columns.slice(index, index + span).some(isFrozenColumn);
  if (!spansFrozenColumn) {
    return {};
  }
  return {
    position: 'sticky',
    left: getFrozenLeftOffset(columns, index),
    zIndex: 1,
  };
}
