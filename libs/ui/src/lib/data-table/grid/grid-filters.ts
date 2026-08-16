/* eslint-disable @typescript-eslint/no-explicit-any */
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { ensureBoolean, orderValues } from '@jetstream/shared/utils';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { isEqual } from 'date-fns/isEqual';
import { isSameDay } from 'date-fns/isSameDay';
import { isValid as isDateValid } from 'date-fns/isValid';
import { parse as parseDate } from 'date-fns/parse';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMinute } from 'date-fns/startOfMinute';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import { EMPTY_FIELD } from './grid-constants';
import { ColumnWithFilter, DataTableFilter, FILTER_SET_TYPES, FilterType } from './grid-types';

/**
 * Pure filtering logic shared by the table's custom TanStack `filterFn`s and the header filter UIs.
 * Ported verbatim (behavior-preserving) from the legacy `data-table-utils.tsx` so existing tables
 * filter identically.
 */

/**
 * Parse a grid cell's date value. Cells render dates as `yyyy-MM-dd h:mm:ss a`, so that format is tried
 * first; anything else (ISO strings, date-only values) falls back to `parseISO`.
 *
 * Do NOT try to pick the strategy by inspecting the string's length — `h` is a 1-2 digit hour, so the
 * formatted length varies with the time of day and any 10/11/12 o'clock value takes the wrong branch.
 */
function parseGridDate(value: string): Date {
  const parsedWithKnownFormat = parseDate(value, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a, new Date());
  if (isDateValid(parsedWithKnownFormat)) {
    return parsedWithKnownFormat;
  }
  return parseISO(value);
}

export function resetFilter(type: FilterType, setValues: string[] = []): DataTableFilter {
  switch (type) {
    case 'TEXT':
      return { type, value: '' };
    case 'NUMBER':
      return { type, value: null, comparator: 'EQUALS' };
    case 'DATE':
      return { type, value: '', comparator: 'GREATER_THAN', ignoreTimestamp: false };
    case 'TIME':
      return { type, value: '', comparator: 'GREATER_THAN' };
    case 'SET':
    case 'BOOLEAN_SET':
      return { type, value: setValues };
    default:
      throw new Error(`Filter type ${type} not supported`);
  }
}

export function isFilterActive(filter: DataTableFilter, totalValues: number): boolean {
  switch (filter?.type) {
    case 'TEXT':
      return !!filter.value;
    case 'NUMBER':
      return isNumber(filter.value) || !!filter.value;
    case 'DATE':
      return !!filter.value;
    case 'TIME':
      return !!filter.value;
    case 'SET':
      return (filter.value?.length || 0) < totalValues;
    case 'BOOLEAN_SET':
      return (filter.value?.length || 0) !== 2;
    default:
      return false;
  }
}

export function filterRecord(filter: DataTableFilter, value: any): boolean {
  switch (filter?.type) {
    case 'TEXT': {
      if (isNumber(value)) {
        value = value.toString();
      }
      if (!isString(value)) {
        return false;
      }
      return value.toLowerCase().includes(filter.value.toLowerCase());
    }
    case 'NUMBER': {
      const filterValue = Number(filter.value);
      if (!isNumber(value)) {
        return false;
      }
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return value > filterValue;
        case 'GREATER_THAN_OR_EQUAL':
          return value >= filterValue;
        case 'LESS_THAN':
          return value < filterValue;
        case 'LESS_THAN_OR_EQUAL':
          return value <= filterValue;
        case 'EQUALS':
        default:
          return value === filterValue;
      }
    }
    case 'DATE': {
      if (!value || !filter.value) {
        return false;
      }
      // The filter value is always day-granular, so the record's date is compared against the start of
      // the selected day. `ignoreTimestamp` additionally floors the record so comparisons are day-to-day.
      const dateFilter = startOfDay(parseISO(filter.value));
      const parsedDate = parseGridDate(value);
      if (!isDateValid(parsedDate) || !isDateValid(dateFilter)) {
        return false;
      }
      const date = filter.ignoreTimestamp ? startOfDay(parsedDate) : parsedDate;
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return isAfter(date, dateFilter);
        case 'GREATER_THAN_OR_EQUAL':
          return isAfter(date, dateFilter) || isSameDay(date, dateFilter);
        case 'LESS_THAN':
          return isBefore(date, dateFilter);
        case 'LESS_THAN_OR_EQUAL':
          return isBefore(date, dateFilter) || isSameDay(date, dateFilter);
        case 'EQUALS':
        default:
          return isSameDay(date, dateFilter);
      }
    }
    case 'TIME': {
      if (!value) {
        return false;
      }
      const dateFilter = startOfMinute(parseDate(filter.value, DATE_FORMATS.HH_MM_SS_SSSS, new Date()));
      const date = startOfMinute(parseDate(value, DATE_FORMATS.HH_MM_SS_a, new Date()));
      if (!isDateValid(dateFilter) || !isDateValid(date)) {
        return false;
      }
      // Both sides parse against the same reference day, so every case compares the times directly.
      // `isSameDay` must NOT be used here — it is always true and would make the comparator match everything.
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return isAfter(date, dateFilter);
        case 'GREATER_THAN_OR_EQUAL':
          return !isBefore(date, dateFilter);
        case 'LESS_THAN':
          return isBefore(date, dateFilter);
        case 'LESS_THAN_OR_EQUAL':
          return !isAfter(date, dateFilter);
        case 'EQUALS':
        default:
          return isEqual(date, dateFilter);
      }
    }
    case 'BOOLEAN_SET': {
      if (!filter.value.length) {
        return false;
      } else if (filter.value.length === 2) {
        return true;
      }
      return value === ensureBoolean(filter.value[0]);
    }
    case 'SET': {
      const includeNulls = filter.value.includes(EMPTY_FIELD);
      return (includeNulls && isNil(value)) || (!isNil(value) && filter.value.includes(String(value)));
    }
    default:
      return false;
  }
}

/**
 * True if any filter in the map is actually narrowing results (used to short-circuit work and to
 * decide whether to retain filter state across data changes).
 */
export function hasFilterApplied(filters: Record<string, DataTableFilter[]>, filterSetValues: Record<string, string[]>): boolean {
  return Object.entries(filters).some(([key, columnFilters]) =>
    columnFilters.some((filter) => {
      switch (filter.type) {
        case 'SET':
          return filter.value.length < (filterSetValues[key]?.length || 0);
        case 'BOOLEAN_SET':
          return filter.value.length < 2; // true/false
        case 'DATE':
        case 'NUMBER':
        case 'TEXT':
        case 'TIME':
          return !!filter.value;
        default:
          return false;
      }
    }),
  );
}

/**
 * Resolve the value used for filtering/grouping a cell — the column's `getValue` if present, else the
 * raw row property.
 */
export function getFilterValue<TRow extends object>(column: ColumnWithFilter<TRow>, row: TRow): unknown {
  if (column.getValue) {
    return column.getValue({ row, column });
  }
  return (row as Record<string, unknown>)[column.key];
}

/**
 * Compute the distinct selectable values for each SET / BOOLEAN_SET column. BOOLEAN_SET is always
 * `['True', 'False']`; SET columns derive their distinct values from the data (null → EMPTY_FIELD).
 */
export function computeFilterSetValues<TRow extends object>(
  columns: ColumnWithFilter<TRow>[],
  data: TRow[],
  ignoreRowInSetFilter?: (row: TRow) => boolean,
  getSubRows?: (row: TRow, index: number) => TRow[] | undefined,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  // Resolve the SET columns once. BOOLEAN_SET is the constant True/False pair and needs no data scan.
  const setColumns: { column: ColumnWithFilter<TRow>; values: Set<string> }[] = [];
  for (const column of columns) {
    const setFilterType = column.filters?.find((type) => FILTER_SET_TYPES.has(type));
    if (!setFilterType) {
      continue;
    }
    if (setFilterType === 'BOOLEAN_SET') {
      result[column.key] = ['True', 'False'];
      continue;
    }
    setColumns.push({ column, values: new Set<string>() });
  }
  if (setColumns.length === 0) {
    return result;
  }

  // Single pass over the data: accumulate every SET column's distinct values together and evaluate
  // `ignoreRowInSetFilter` once per row. The previous implementation scanned the entire dataset once PER
  // SET column (filter→map→Set→sort, with two row-length temp arrays each), which dominated the initial
  // render of wide query results.
  //
  // Trees (`getSubRows`) are traversed depth-first — the filterable values often live on CHILD rows
  // (e.g. Automation Control: top-level rows are category headers excluded via `ignoreRowInSetFilter`,
  // the automation items are their children), mirroring the quick-filter search index's traversal.
  const visitRow = (row: TRow, index: number) => {
    if (!ignoreRowInSetFilter || !ignoreRowInSetFilter(row)) {
      for (const { column, values } of setColumns) {
        const rowValue = getFilterValue(column, row);
        values.add(isNil(rowValue) ? EMPTY_FIELD : String(rowValue));
      }
    }
    getSubRows?.(row, index)?.forEach(visitRow);
  };
  data.forEach(visitRow);

  for (const { column, values } of setColumns) {
    result[column.key] = orderValues(Array.from(values));
  }
  return result;
}
