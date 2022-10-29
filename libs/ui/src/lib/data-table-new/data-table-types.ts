import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Column } from 'react-data-grid';

export type RowWithKey = Record<string, any> & { _key: string };

export type FilterType = 'TEXT' | 'NUMBER' | 'DATE' | 'SET' | 'BOOLEAN_SET';
export const FILTER_SET_TYPES = new Set<FilterType>(['SET', 'BOOLEAN_SET']);

export type DataTableFilter =
  | DataTableTextFilter
  | DataTableNumberFilter
  | DataTableDateFilter
  | DataTableSetFilter
  | DataTableBooleanSetFilter;

export interface DataTableTextFilter {
  type: 'TEXT';
  value: string;
}

export interface DataTableNumberFilter {
  type: 'NUMBER';
  value: string | null;
  comparator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
}

export interface DataTableDateFilter {
  type: 'DATE';
  value: string;
  comparator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
}

export interface DataTableSetFilter {
  type: 'SET';
  value: string[];
}

export interface DataTableBooleanSetFilter {
  type: 'BOOLEAN_SET';
  value: string[];
}

export interface ColumnWithFilter<TRow, TSummaryRow = unknown> extends Column<TRow, TSummaryRow> {
  /** getValue is used when filtering or sorting rows */
  readonly getValue?: (row: TRow) => string;
  readonly filters?: FilterType[];
}

export interface SalesforceQueryColumnDefinition<TRow, TSummaryRow = unknown> {
  parentColumns: ColumnWithFilter<TRow, TSummaryRow>[];
  subqueryColumns: MapOf<ColumnWithFilter<TRow, TSummaryRow>[]>;
}

export interface FilterContextProps {
  filterSetValues: Record<string, string[]>;
  filters: Record<string, DataTableFilter[]>;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export interface SubqueryContext<TRow = any> {
  serverUrl: string;
  org: SalesforceOrgUi;
  isTooling: boolean;
  columnDefinitions: MapOf<ColumnWithFilter<TRow, unknown>[]>;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
}
