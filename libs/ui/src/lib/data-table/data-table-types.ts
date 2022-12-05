import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Column } from 'react-data-grid';

export type RowWithKey = Record<string, any> & { _key: string };
export type ColumnType = 'text' | 'number' | 'subquery' | 'object' | 'location' | 'date' | 'time' | 'boolean' | 'address' | 'salesforceId';
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
  readonly getValue?: (params: { row: TRow; column: ColumnWithFilter<TRow, unknown> }) => string;
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
  columnDefinitions: MapOf<ColumnWithFilter<TRow, unknown>[]>;
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
