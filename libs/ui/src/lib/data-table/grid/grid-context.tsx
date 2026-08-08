/* eslint-disable @typescript-eslint/no-explicit-any */
import { NOOP } from '@jetstream/shared/utils';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
import { createContext, useContext } from 'react';
import { ColumnWithFilter, FilterContextProps, RowWithKey, SelectedRowsContext, SubqueryContext, TanstackTable } from './grid-types';

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
export interface GridRuntime<TRow extends object = RowWithKey> {
  table: TanstackTable<TRow>;
  gridId: string;
  getRowKey: (row: TRow) => string;
  /** Ordered, visible author-facing columns (kept in sync with TanStack column order). */
  columns: ColumnWithFilter<TRow>[];
}

/** Row-model input slices. GridContainer and GridBody subscribe to these so anything that changes
 * the set/order of rows re-renders them even when the change bypasses React state (the atom-owned
 * `expanded` slice); the React-state slices are included for uniformity and cost nothing (their
 * post-commit publish compares equal when unchanged). */
export const selectRowModelInputs = (state: {
  sorting: unknown;
  columnFilters: unknown;
  globalFilter: unknown;
  grouping: unknown;
  expanded: unknown;
}) => ({
  sorting: state.sorting,
  columnFilters: state.columnFilters,
  globalFilter: state.globalFilter,
  grouping: state.grouping,
  expanded: state.expanded,
});

export const GridRuntimeContext = createContext<GridRuntime | undefined>(undefined);

export function useGridRuntime<TRow extends object = RowWithKey>(): GridRuntime<TRow> {
  const runtime = useContext(GridRuntimeContext);
  if (!runtime) {
    throw new Error('useGridRuntime must be used within a GridContainer');
  }
  return runtime as unknown as GridRuntime<TRow>;
}
