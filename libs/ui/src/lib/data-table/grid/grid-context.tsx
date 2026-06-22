/* eslint-disable @typescript-eslint/no-explicit-any */
import { NOOP } from '@jetstream/shared/utils';
import type { Table } from '@tanstack/react-table';
import { createContext, useContext } from 'react';
import { ColumnWithFilter, FilterContextProps, RowWithKey, SelectedRowsContext, SubqueryContext } from './grid-types';

/** Filter state for header filter UIs + renderers that need the active filters. */
export const GridFilterContext = createContext<FilterContextProps>({
  filterSetValues: {},
  filters: {},
  updateFilter: NOOP,
});

/** Subquery modal configuration + callbacks. */
export const GridSubqueryContext = createContext<SubqueryContext | undefined>(undefined);

/** Selected row tracking for renderers that branch on selection. */
export const GridSelectedContext = createContext<SelectedRowsContext>({ selectedRowIds: new Set() });

/** Arbitrary data bag passed by the consumer (org, onRecordAction, defaultApiVersion, rows, columns, ...). */
export const GridGenericContext = createContext<Record<string, any>>({});

/**
 * Shared grid runtime: the TanStack table instance + a few config values renderers/cells need without
 * threading props through every layer.
 */
export interface GridRuntime<TRow = RowWithKey> {
  table: Table<TRow>;
  gridId: string;
  getRowKey: (row: TRow) => string;
  /** Ordered, visible author-facing columns (kept in sync with TanStack column order). */
  columns: ColumnWithFilter<TRow>[];
  /** Read the shift-click range-selection anchor — the last row whose checkbox was toggled when a
   * range wasn't applied, or null. Backed by a stable ref in GridContainer so every select cell agrees on it. */
  getRowSelectionAnchor?: () => string | null;
  /** Set the shift-click range-selection anchor (or clear it with null). */
  setRowSelectionAnchor?: (rowId: string | null) => void;
}

export const GridRuntimeContext = createContext<GridRuntime | undefined>(undefined);

export function useGridRuntime<TRow = RowWithKey>(): GridRuntime<TRow> {
  const runtime = useContext(GridRuntimeContext);
  if (!runtime) {
    throw new Error('useGridRuntime must be used within a GridContainer');
  }
  return runtime as unknown as GridRuntime<TRow>;
}
