/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ExpandedState,
  GroupingState,
  RowSelectionState,
  SortingState,
  Table,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import isNil from 'lodash/isNil';
import uniqueId from 'lodash/uniqueId';
import { useCallback, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from 'react';
import { buildColumnDefs } from '../buildColumnDefs';
import { ColumnFilterValue, makeGlobalFilterFn } from '../filterFns';
import { EMPTY_FIELD, NON_DATA_COLUMN_KEYS } from '../grid-constants';
import { computeFilterSetValues, hasFilterApplied, isFilterActive, resetFilter } from '../grid-filters';
import { getSearchTextByRow, getSortedFilteredLeafRows } from '../grid-row-utils';
import {
  ColumnWithFilter,
  DataTableFilter,
  DataTableRef,
  DefaultColumnOptions,
  FILTER_SET_TYPES,
  RowWithKey,
  SortColumn,
} from '../grid-types';

export interface UseJetstreamTableOptions<TRow = RowWithKey> {
  data: TRow[];
  columns: ColumnWithFilter<TRow>[];
  getRowKey: (row: TRow) => string;
  ref?: React.Ref<DataTableRef<TRow>>;
  initialSortColumns?: SortColumn[];
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  /** Rows that always pass filters (e.g. group/category headers). MUST be referentially stable: TanStack
   * caches the filtered-row-model on the filter *value* (not on this fn's identity), so an unstable
   * predicate whose captured state changed under an active quick filter wouldn't re-evaluate bypassed
   * rows until the search text changes. Pass a module-level or memoized function. */
  rowAlwaysVisible?: (row: TRow) => boolean;
  ignoreRowInSetFilter?: (row: TRow) => boolean;
  defaultColumnOptions?: DefaultColumnOptions<TRow>;
  enableRowSelection?: boolean;
  enableMultiSort?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly TRow[]) => void;
  /** Fired when the sort changes (legacy DataTree persists sort to storage via this). */
  onSortColumnsChange?: (sortColumns: SortColumn[]) => void;
  /** Column keys to group rows by (creates group header rows). */
  grouping?: string[];
  /** For genuine parent→child hierarchy: return a row's child rows. */
  getSubRows?: (row: TRow, index: number) => TRow[] | undefined;
  /** Controlled expanded state (TanStack). When omitted, expansion is internal. */
  expanded?: ExpandedState;
  onExpandedChange?: (expanded: ExpandedState) => void;
  /** Initial expanded state when uncontrolled — `true` expands all groups/rows. */
  defaultExpanded?: ExpandedState | boolean;
}

export interface UseJetstreamTableResult<TRow = RowWithKey> {
  table: Table<TRow>;
  gridId: string;
  columns: ColumnWithFilter<TRow>[];
  /** Ordered, visible author-facing columns kept in sync with the TanStack column order. */
  orderedColumns: ColumnWithFilter<TRow>[];
  filters: Record<string, DataTableFilter[]>;
  filterSetValues: Record<string, string[]>;
  updateFilter: (columnKey: string, filter: DataTableFilter) => void;
  /** Mirror of the legacy ADD_MODIFIED_VALUE_TO_SET_FILTER — keep edited values visible under a SET filter. */
  registerEditedValues: (columnKey: string, values: unknown[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter reducer (ported from the legacy useDataTable reducer to preserve behavior)
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  hasFilters: boolean;
  columnMap: Map<string, ColumnWithFilter<any>>;
  filters: Record<string, DataTableFilter[]>;
  filterSetValues: Record<string, string[]>;
}

type FilterAction =
  | { type: 'INIT'; payload: { columns: ColumnWithFilter<any>[]; data: any[]; ignoreRowInSetFilter?: (row: any) => boolean } }
  | { type: 'ADD_EDITED_VALUES'; payload: { columnKey: string; values: unknown[] } }
  | { type: 'UPDATE_FILTER'; payload: { columnKey: string; filter: DataTableFilter } };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'INIT': {
      const { columns, data, ignoreRowInSetFilter } = action.payload;
      const columnMap = new Map(columns.map((column) => [column.key, column]));

      // Retain existing filter values when only the data changed (column count is the cheap proxy used by the legacy grid).
      const hasFilters = state.hasFilters && columnMap.size === state.columnMap.size;
      const filters: Record<string, DataTableFilter[]> = hasFilters
        ? structuredClone(state.filters)
        : columns.reduce((acc: Record<string, DataTableFilter[]>, column) => {
            if (Array.isArray(column.filters)) {
              acc[column.key] = column.filters.map((filterType) => resetFilter(filterType, []));
            }
            return acc;
          }, {});

      const distinctSetValues = computeFilterSetValues(columns, data, ignoreRowInSetFilter);

      // Default SET filters to "all selected" unless the user previously customized the selection.
      Object.keys(filters).forEach((columnKey) => {
        const setFilter = filters[columnKey]?.find(({ type }) => FILTER_SET_TYPES.has(type));
        const allValues = distinctSetValues[columnKey];
        if (!setFilter || !allValues) {
          return;
        }
        const prevAll = state.filterSetValues?.[columnKey];
        if (!hasFilters || !setFilter.value || !prevAll || setFilter.value.length === prevAll.length) {
          (setFilter as { value: string[] }).value = allValues;
        }
      });

      return { hasFilters, columnMap, filters, filterSetValues: distinctSetValues };
    }
    case 'ADD_EDITED_VALUES': {
      const { columnKey, values } = action.payload;
      if (!state.filters[columnKey]) {
        return state;
      }
      const newValues = values.map((value) => (value === '' || isNil(value) ? EMPTY_FIELD : String(value)));
      const filterSetValues = {
        ...state.filterSetValues,
        [columnKey]: Array.from(new Set([...(state.filterSetValues[columnKey] || []), ...newValues])),
      };
      const columnFilter = state.filters[columnKey].map((item) =>
        item.type !== 'SET' ? item : { ...item, value: Array.from(new Set(item.value.concat(newValues))) },
      );
      return { ...state, filterSetValues, filters: { ...state.filters, [columnKey]: columnFilter } };
    }
    case 'UPDATE_FILTER': {
      const { columnKey, filter } = action.payload;
      const filters = {
        ...state.filters,
        [columnKey]: state.filters[columnKey].map((currentFilter) => (currentFilter.type === filter.type ? filter : currentFilter)),
      };
      return { ...state, hasFilters: hasFilterApplied(filters, state.filterSetValues), filters };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useJetstreamTable<TRow = RowWithKey>(options: UseJetstreamTableOptions<TRow>): UseJetstreamTableResult<TRow> {
  const {
    data,
    columns,
    getRowKey,
    ref,
    initialSortColumns,
    quickFilterText,
    includeQuickFilter,
    rowAlwaysVisible,
    ignoreRowInSetFilter,
    defaultColumnOptions,
    enableRowSelection,
    enableMultiSort = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    onReorderColumns,
    onSortedAndFilteredRowsChange,
    onSortColumnsChange,
    grouping,
    getSubRows,
    expanded: controlledExpanded,
    onExpandedChange,
    defaultExpanded,
  } = options;

  const [gridId] = useState(() => uniqueId('grid-'));

  // Hold getRowKey in a ref so an unstable (inline) callback identity does not force expensive work
  // (the search index rebuild) on every render. The wrapper is referentially stable.
  const getRowKeyRef = useRef(getRowKey);
  getRowKeyRef.current = getRowKey;
  const stableGetRowKey = useCallback((row: TRow) => getRowKeyRef.current(row), []);

  const columnByKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);

  // Our global-search index aggregates EVERY column's text per row, so the quick filter only needs a
  // single carrier column to evaluate it. Designating one (the first data column) makes global
  // filtering O(rows) instead of O(rows × columns) — the difference between smooth and janky at 50k+.
  const globalFilterColumnId = useMemo(() => columns.find((column) => !NON_DATA_COLUMN_KEYS.has(column.key))?.key, [columns]);
  // Key the column-def memo on defaultColumnOptions CONTENT (not identity) so an inline `{...}` prop
  // does not rebuild the entire TanStack column model on every parent render.
  const defaultColumnOptionsKey = JSON.stringify(defaultColumnOptions ?? null);
  const columnDefs = useMemo(
    () => buildColumnDefs(columns, defaultColumnOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, defaultColumnOptionsKey],
  );

  const [sorting, setSorting] = useState<SortingState>(() =>
    (initialSortColumns || []).map((sortColumn) => ({ id: sortColumn.columnKey, desc: sortColumn.direction === 'DESC' })),
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => columns.map((column) => column.key));
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const rowSelection = controlledRowSelection ?? internalRowSelection;

  const groupingState: GroupingState = useMemo(() => grouping ?? [], [grouping]);
  const isHierarchical = !!getSubRows || groupingState.length > 0;
  const [internalExpanded, setInternalExpanded] = useState<ExpandedState>(() =>
    defaultExpanded === true ? true : typeof defaultExpanded === 'object' ? defaultExpanded : {},
  );
  const expanded = controlledExpanded ?? internalExpanded;

  const [{ filters, filterSetValues }, dispatch] = useReducer(filterReducer, {
    hasFilters: false,
    columnMap: new Map(),
    filters: {},
    filterSetValues: {},
  });

  // Initialize / refresh filters + distinct set values when columns or data change.
  useEffect(() => {
    dispatch({ type: 'INIT', payload: { columns, data, ignoreRowInSetFilter } });
  }, [columns, data, ignoreRowInSetFilter]);

  // Reset column order when the column set changes.
  useNonInitialEffect(() => {
    setColumnOrder(columns.map((column) => column.key));
  }, [columns]);

  const updateFilter = useCallback((columnKey: string, filter: DataTableFilter) => {
    dispatch({ type: 'UPDATE_FILTER', payload: { columnKey, filter } });
  }, []);

  const registerEditedValues = useCallback((columnKey: string, values: unknown[]) => {
    dispatch({ type: 'ADD_EDITED_VALUES', payload: { columnKey, values } });
  }, []);

  // Defer the (O(rows × columns)) global-search index until the quick filter is actually used. Building
  // it during initial render froze the main thread for seconds on large query results even though the
  // user had typed nothing. This flag latches true on first non-empty quick filter and never flips back.
  const [quickFilterEngaged, setQuickFilterEngaged] = useState(false);
  useEffect(() => {
    if (!quickFilterEngaged && includeQuickFilter && !!quickFilterText) {
      setQuickFilterEngaged(true);
    }
  }, [quickFilterEngaged, includeQuickFilter, quickFilterText]);

  // Precompute the global-search index, but only once the quick filter has been engaged. Depends on
  // data/columns/quickFilterEngaged ONLY — NOT on quickFilterText or getRowKey identity — so typing in
  // the search box never rebuilds the index. While it stays empty (filter never used), globalFilter is
  // also empty so makeGlobalFilterFn short-circuits to "show all rows".
  const rowFilterText = useMemo(() => {
    if (!includeQuickFilter || !quickFilterEngaged || !Array.isArray(data) || !data.length || !columns.length) {
      return {} as Record<string, string>;
    }
    return getSearchTextByRow(data, columns, stableGetRowKey, getSubRows);
  }, [includeQuickFilter, quickFilterEngaged, data, columns, stableGetRowKey, getSubRows]);

  // Derive TanStack columnFilters from our filter map (only columns whose filters actually narrow).
  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const result: ColumnFiltersState = [];
    Object.entries(filters).forEach(([columnKey, columnFilters]) => {
      const totalSetValues = filterSetValues[columnKey]?.length ?? 0;
      const active = columnFilters.some((filter) => isFilterActive(filter, totalSetValues));
      const column = columnByKey.get(columnKey);
      if (!active || !column) {
        return;
      }
      const value: ColumnFilterValue<TRow> = { filters: columnFilters, column, totalSetValues, rowAlwaysVisible };
      result.push({ id: columnKey, value });
    });
    return result;
  }, [filters, filterSetValues, columnByKey, rowAlwaysVisible]);

  // The value embeds the (lazily built) search index purely so its identity busts TanStack's
  // filtered-model cache when the index materializes — see GlobalFilterValue.
  const globalFilter = useMemo(
    () => (includeQuickFilter && quickFilterText ? { text: quickFilterText, rowFilterText } : undefined),
    [includeQuickFilter, quickFilterText, rowFilterText],
  );
  const globalFilterFn = useMemo(
    () => makeGlobalFilterFn(rowFilterText, stableGetRowKey, rowAlwaysVisible),
    [rowFilterText, stableGetRowKey, rowAlwaysVisible],
  );

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      // Resolve outside the setState updater — updaters must be pure (StrictMode double-invokes them,
      // which would fire onSortColumnsChange twice).
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      if (onSortColumnsChange) {
        onSortColumnsChange(next.map((sort) => ({ columnKey: sort.id, direction: sort.desc ? 'DESC' : 'ASC' })));
      }
      setSorting(next);
    },
    [sorting, onSortColumnsChange],
  );

  const handleExpandedChange = useCallback(
    (updater: ExpandedState | ((old: ExpandedState) => ExpandedState)) => {
      const next = typeof updater === 'function' ? updater(expanded) : updater;
      if (onExpandedChange) {
        onExpandedChange(next);
      }
      if (controlledExpanded === undefined) {
        setInternalExpanded(next);
      }
    },
    [expanded, onExpandedChange, controlledExpanded],
  );

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      if (onRowSelectionChange) {
        onRowSelectionChange(next);
      }
      if (controlledRowSelection === undefined) {
        setInternalRowSelection(next);
      }
    },
    [rowSelection, onRowSelectionChange, controlledRowSelection],
  );

  const table = useReactTable<TRow>({
    data,
    columns: columnDefs,
    state: { sorting, columnFilters, globalFilter, columnOrder, columnSizing, rowSelection, grouping: groupingState, expanded },
    // Coerce to string: `getRowKey` is typed to return a string but some callers derive it from `any`
    // record data (e.g. a numeric id), and a non-string `row.id` later breaks string ops such as the
    // `rowId.startsWith(...)` inside `isSummaryRowId` during keyboard navigation.
    getRowId: (row) => String(stableGetRowKey(row)),
    enableRowSelection: enableRowSelection ?? false,
    enableMultiSort,
    enableSortingRemoval: true,
    // Don't collapse expanded groups/rows when data changes (a bulk edit or applying a column filter
    // rebuilds the row model — without this TanStack resets expansion and the children disappear).
    autoResetExpanded: false,
    // Defer applying widths until mouse release (SLDS behavior): during the drag only the divider
    // guide line moves, then the grid re-lays-out once. Live-resizing re-renders every visible row
    // per mousemove, which lags on wide/tall tables.
    columnResizeMode: 'onEnd',
    // Keep declared column order (don't auto-move grouped columns to the front); we render group rows ourselves.
    groupedColumnMode: false,
    getSubRows,
    // For getSubRows trees, filter from leaves up so a match on a child (e.g. a flow version) keeps its
    // ancestor rows visible, instead of being dropped because the parent didn't match.
    filterFromLeafRows: !!getSubRows,
    globalFilterFn,
    // Evaluate the quick filter on a single carrier column (see globalFilterColumnId). Falls back to
    // TanStack's default (string columns) if there is no data column.
    getColumnCanGlobalFilter: globalFilterColumnId ? (column) => column.id === globalFilterColumnId : undefined,
    onSortingChange: handleSortingChange,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: handleRowSelectionChange,
    onExpandedChange: handleExpandedChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Only wire grouping/expansion row models when actually used, to keep flat tables lean.
    ...(groupingState.length > 0 ? { getGroupedRowModel: getGroupedRowModel() } : {}),
    ...(isHierarchical ? { getExpandedRowModel: getExpandedRowModel() } : {}),
    meta: { gridId },
  });

  const orderedColumns = useMemo(() => {
    const ordered = columnOrder.map((key) => columnByKey.get(key)).filter((column): column is ColumnWithFilter<TRow> => !!column);
    // Include any columns missing from columnOrder (defensive) preserving their declared order.
    if (ordered.length !== columns.length) {
      const seen = new Set(ordered.map((column) => column.key));
      columns.forEach((column) => {
        if (!seen.has(column.key)) {
          ordered.push(column);
        }
      });
    }
    return ordered;
  }, [columnOrder, columnByKey, columns]);

  // Notify subscribers of the filtered + sorted DATA rows (collapse-independent; group rows excluded).
  const sortedFlatRows = table.getSortedRowModel().flatRows;
  useEffect(() => {
    if (onSortedAndFilteredRowsChange) {
      onSortedAndFilteredRowsChange(getSortedFilteredLeafRows(table).map((row) => row.original));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedFlatRows, onSortedAndFilteredRowsChange]);

  // Fire the reorder callback with data-column keys + the PERMUTATION of their original indexes —
  // consumers (e.g. QueryResults) use the index permutation to reorder parsedQuery.fields, so an
  // identity array would silently break "reorder columns updates the SOQL query".
  useNonInitialEffect(() => {
    if (!onReorderColumns) {
      return;
    }
    const originalIndexByKey = new Map(
      columns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map((column, index) => [column.key, index]),
    );
    const dataColumns = orderedColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
    onReorderColumns(
      dataColumns,
      dataColumns.map((key) => originalIndexByKey.get(key) ?? -1).filter((index) => index >= 0),
    );
  }, [columnOrder]);

  useImperativeHandle(
    ref,
    (): DataTableRef<TRow> => ({
      hasSortApplied: () => sorting.length > 0,
      getFilteredAndSortedRows: () => getSortedFilteredLeafRows(table).map((row) => row.original),
      hasReorderedColumns: () => columnOrder.some((key, index) => columns[index]?.key !== key),
      getCurrentColumns: () => orderedColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)),
      getCurrentColumnNames: () => orderedColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key),
    }),
    [table, sorting.length, columnOrder, columns, orderedColumns],
  );

  return {
    table,
    gridId,
    columns,
    orderedColumns,
    filters,
    filterSetValues,
    updateFilter,
    registerEditedValues,
  };
}
