/* eslint-disable @typescript-eslint/no-explicit-any */
import { NOOP } from '@jetstream/shared/utils';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
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
 * Stable record-action context consumed by high-cardinality cell renderers (the id/name link cells).
 * Kept separate from `GridGenericContext` on purpose: the generic bag carries a volatile `rows` array
 * that is rebuilt on every data/sort/filter change, and because a cell's `useContext` subscribes its
 * owning `GridCell`, bundling these stable values there forced every link/popover cell to re-render on
 * each keystroke. This context only changes when the org/serverUrl/onRecordAction actually change.
 */
export interface RecordActionContextValue {
  org?: SalesforceOrgUi;
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  onRecordAction?: (action: CloneEditView, recordId: string, sobjectName: string) => void;
}

export const GridRecordActionContext = createContext<RecordActionContextValue>({});

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
  /** Read the shift-click range-selection anchor — the last row whose checkbox was toggled without
   * Shift, or null. Backed by a stable ref in GridContainer so every select cell agrees on it. */
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
