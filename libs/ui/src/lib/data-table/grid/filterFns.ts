/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FilterFn, Row } from '@tanstack/react-table';
import { filterRecord, getFilterValue, isFilterActive } from './grid-filters';
import { ColumnWithFilter, DataTableFilter } from './grid-types';

/**
 * Custom TanStack filter functions. The legacy table stored filters as `Record<colKey, DataTableFilter[]>`
 * and applied `filters.filter(isFilterActive).every(f => filterRecord(f, getValue(row)))`. We relocate
 * that exact predicate composition into a per-column TanStack `filterFn`.
 *
 * A column's filter value (the entry in TanStack `columnFilters`) carries everything the predicate
 * needs: the active filters, the column (so `getValue` can run), and the count of distinct SET values
 * (so `isFilterActive` can tell whether a SET filter is actually narrowing).
 */
export interface ColumnFilterValue<TRow = any> {
  filters: DataTableFilter[];
  column: ColumnWithFilter<TRow>;
  totalSetValues: number;
  /** When provided and true for a row, the row bypasses all column filters (legacy `rowAlwaysVisible`). */
  rowAlwaysVisible?: (row: TRow) => boolean;
}

export const jetstreamColumnFilterFn: FilterFn<any> = (row: Row<any>, _columnId, filterValue: ColumnFilterValue) => {
  if (!filterValue || !Array.isArray(filterValue.filters)) {
    return true;
  }
  const { filters, column, totalSetValues, rowAlwaysVisible } = filterValue;
  if (rowAlwaysVisible && rowAlwaysVisible(row.original)) {
    return true;
  }
  const activeFilters = filters.filter((filter) => isFilterActive(filter, totalSetValues));
  if (activeFilters.length === 0) {
    return true;
  }
  const value = getFilterValue(column, row.original);
  return activeFilters.every((filter) => filterRecord(filter, value));
};

// TanStack requires `resolveFilterValue` / `autoRemove` to be undefined for object filter values; this
// keeps the value object intact between renders.
jetstreamColumnFilterFn.autoRemove = (filterValue: ColumnFilterValue) => !filterValue || filterValue.filters.length === 0;

/**
 * The global-filter STATE value. Carries the search index alongside the text: TanStack's filtered-row
 *-model cache keys on the globalFilter VALUE (not the filterFn identity), so when the lazily built
 * index materializes after the first filter event, the value's identity change is what forces a
 * refilter — with a plain string the table would stay stuck on the "filtered with an empty index"
 * (i.e. zero-row) result until the user typed another character.
 */
export interface GlobalFilterValue {
  text: string;
  rowFilterText: Record<string, string>;
}

/**
 * Build a global (quick search) filter function bound to a precomputed per-row search index. Returns
 * true when the row's concatenated lowercase text contains the needle. Ignores `columnId` (the same
 * answer holds for every column of a row), so the first column short-circuits.
 */
export function makeGlobalFilterFn<TRow>(
  rowFilterText: Record<string, string>,
  getRowKey: (row: TRow) => string,
  rowAlwaysVisible?: (row: TRow) => boolean,
): FilterFn<TRow> {
  return (row, _columnId, filterValue: GlobalFilterValue | string) => {
    const needle = typeof filterValue === 'string' ? filterValue : (filterValue?.text ?? '');
    if (!needle) {
      return true;
    }
    if (rowAlwaysVisible && rowAlwaysVisible(row.original)) {
      return true;
    }
    const key = getRowKey(row.original);
    const text = key ? rowFilterText[key] : undefined;
    return !!text && text.includes(String(needle).toLowerCase());
  };
}
