/* eslint-disable @typescript-eslint/no-explicit-any */
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { ensureBoolean, orderValues } from '@jetstream/shared/utils';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
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

export function resetFilter(type: FilterType, setValues: string[] = []): DataTableFilter {
  switch (type) {
    case 'TEXT':
      return { type, value: '' };
    case 'NUMBER':
      return { type, value: null, comparator: 'EQUALS' };
    case 'DATE':
      return { type, value: '', comparator: 'GREATER_THAN' };
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
        case 'LESS_THAN':
          return value < filterValue;
        case 'EQUALS':
        default:
          return value === filterValue;
      }
    }
    case 'DATE': {
      if (!value || !filter.value) {
        return false;
      }
      const dateFilter = startOfDay(parseISO(filter.value));
      let date: Date;
      if (value.length === 21) {
        date = parseDate(value, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a, new Date());
      } else {
        date = startOfDay(parseISO(value));
      }
      if (!isDateValid(date)) {
        return false;
      }
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return isAfter(date, dateFilter);
        case 'LESS_THAN':
          return isBefore(date, dateFilter);
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
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return isAfter(date, dateFilter);
        case 'LESS_THAN':
          return isBefore(date, dateFilter);
        case 'EQUALS':
        default:
          return isSameDay(date, dateFilter);
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
export function getFilterValue<TRow>(column: ColumnWithFilter<TRow>, row: TRow): unknown {
  if (column.getValue) {
    return column.getValue({ row, column });
  }
  return (row as Record<string, unknown>)[column.key];
}

/**
 * Compute the distinct selectable values for each SET / BOOLEAN_SET column. BOOLEAN_SET is always
 * `['True', 'False']`; SET columns derive their distinct values from the data (null → EMPTY_FIELD).
 */
export function computeFilterSetValues<TRow>(
  columns: ColumnWithFilter<TRow>[],
  data: TRow[],
  ignoreRowInSetFilter?: (row: TRow) => boolean,
): Record<string, string[]> {
  const columnsByKey = new Map(columns.map((column) => [column.key, column]));
  return columns.reduce((acc: Record<string, string[]>, column) => {
    const setFilterType = column.filters?.find((type) => FILTER_SET_TYPES.has(type));
    if (!setFilterType) {
      return acc;
    }
    if (setFilterType === 'BOOLEAN_SET') {
      acc[column.key] = ['True', 'False'];
      return acc;
    }
    const resolvedColumn = columnsByKey.get(column.key);
    if (!resolvedColumn) {
      return acc;
    }
    acc[column.key] = orderValues(
      Array.from(
        new Set(
          data
            .filter((row) => (ignoreRowInSetFilter ? !ignoreRowInSetFilter(row) : true))
            .map((row) => {
              const rowValue = getFilterValue(resolvedColumn, row);
              return isNil(rowValue) ? EMPTY_FIELD : String(rowValue);
            }),
        ),
      ),
    );
    return acc;
  }, {});
}
