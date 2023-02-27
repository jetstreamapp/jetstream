import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Column } from 'react-data-grid';

export type RowWithKey = Record<string, any> & { _key: string };
export type ColumnType = 'text' | 'number' | 'subquery' | 'object' | 'location' | 'date' | 'time' | 'boolean' | 'address' | 'salesforceId';
export type FilterType = 'TEXT' | 'NUMBER' | 'DATE' | 'TIME' | 'SET' | 'BOOLEAN_SET';
export const FILTER_SET_TYPES = new Set<FilterType>(['SET', 'BOOLEAN_SET']);

export type DataTableFilter =
  | DataTableTextFilter
  | DataTableNumberFilter
  | DataTableDateFilter
  | DataTableTimeFilter
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
  value: string | null;
  comparator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
}

export interface DataTableTimeFilter {
  type: 'TIME';
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
  readonly getValue?: (params: { row: TRow; column: ColumnWithFilter<TRow, unknown> }) => string | null;
  readonly filters?: FilterType[];
  /** If column reordering is enabled for a table, prevent column from reorder */
  readonly preventReorder?: boolean;
}

export interface SalesforceQueryColumnDefinition<TRow, TSummaryRow = unknown> {
  parentColumns: ColumnWithFilter<TRow, TSummaryRow>[];
  subqueryColumns: MapOf<ColumnWithFilter<TRow, TSummaryRow>[]>;
}

export interface FilterContextProps {
  filterSetValues: Record<string, string[]>;
  filters: Record<string, DataTableFilter[]>;
  /** Reference to element to attach portal to in table filters, needed when table is shown in a modal */
  portalRefForFilters?: any; // TODO: add types
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export interface SubqueryContext<TRow = any> {
  serverUrl: string;
  org: SalesforceOrgUi;
  isTooling: boolean;
  columnDefinitions?: MapOf<ColumnWithFilter<TRow, unknown>[]>;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
}

export interface SelectedRowsContext<TRow = any> {
  selectedRowIds: Set<any>;
  getRowKey?: (row: TRow) => string;
}

export interface SalesforceLocationField {
  latitude: number;
  longitude: number;
}

export interface SalesforceAddressField {
  city?: string;
  country?: string;
  CountryCode?: string;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  state?: string;
  StateCode?: string;
  street?: string;
}

export type ContextAction =
  | 'COPY_CELL'
  | 'COPY_ROW_EXCEL'
  | 'COPY_ROW_JSON'
  | 'COPY_COL'
  | 'COPY_COL_JSON'
  | 'COPY_COL_NO_HEADER'
  | 'COPY_TABLE'
  | 'COPY_TABLE_JSON';

export type ContextMenuActionData<T> = {
  row: T;
  rows: T[];
  rowIdx: number;
  column: ColumnWithFilter<T, unknown>;
  columns: ColumnWithFilter<T, unknown>[];
};
