/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import type { Header, Row, RowData, Table } from '@tanstack/react-table';
import { ReactNode } from 'react';

/**
 * Jetstream Data Table — type definitions.
 *
 * This module intentionally has NO dependency on `react-data-grid`. It is the rewritten replacement
 * for `data-table-types.ts` and defines the public, author-facing column/row/filter shapes plus the
 * render/edit prop contracts that replace react-data-grid's `RenderCellProps` / `RenderEditCellProps`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

export type RowWithKey = Record<string, any> & { _key: string };

export type RowSalesforceRecordWithKey = RowWithKey & {
  _action: (row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'delete' | 'undelete' | 'apex') => void;
  _idx: number;
  _record: Record<string, any>;
  _touchedColumns: Set<string>;
  _saveError?: Maybe<string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Column + filter type discriminators (unchanged from the legacy implementation)
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnType =
  | 'text'
  | 'number'
  | 'subquery'
  | 'object'
  | 'location'
  | 'date'
  | 'time'
  | 'boolean'
  | 'address'
  | 'salesforceId'
  | 'salesforceName'
  | 'textOrSalesforceId';

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

// ─────────────────────────────────────────────────────────────────────────────
// Sort
// ─────────────────────────────────────────────────────────────────────────────

export type SortDirection = 'ASC' | 'DESC';

/** Replacement for react-data-grid's `SortColumn`. Same shape so call sites are source-compatible. */
export interface SortColumn {
  readonly columnKey: string;
  readonly direction: SortDirection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render / edit prop contracts (replace react-data-grid `RenderCellProps`/`RenderEditCellProps`)
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableCellProps<TRow = RowWithKey, TSummaryRow = unknown> {
  /** Convenience alias for `tanstackRow.original` */
  row: TRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  /** Accessor value for this cell (post `getValue`/`accessorFn`) */
  value: unknown;
  /** Index within the current filtered + sorted (+ flattened) row model */
  rowIndex: number;
  /** rdg-compat alias of rowIndex */
  rowIdx: number;
  /** Escape hatch to the underlying TanStack row */
  tanstackRow: Row<TRow>;
  /** Tree (getSubRows) sugar — depth of this row in the tree (0 = root). */
  depth: number;
  /** Tree (getSubRows) sugar — true when this row has child rows that can be expanded/collapsed. */
  canExpand: boolean;
  /** Tree (getSubRows) sugar — current expanded state (false when the row cannot expand). */
  isExpanded: boolean;
  /** Tree (getSubRows) sugar — toggle this row's expanded state. No-op when the row cannot expand. */
  toggleExpanded: () => void;
  isEditing: boolean;
  startEdit: () => void;
  /** Commit an updated row; mirrors the old `onRowChange(row, true)` */
  commitEdit: (updatedRow: TRow, options?: { closeAndFocus?: boolean }) => void;
  cancelEdit: () => void;
}

export interface DataTableHeaderProps<TRow = RowWithKey, TSummaryRow = unknown> {
  column: ColumnWithFilter<TRow, TSummaryRow>;
  sortDirection?: SortDirection;
  /** Sort priority (1-based) when multi-column sorting is active */
  priority?: number;
  header: Header<TRow, unknown>;
  /** Children-as-function pattern used by `FilterRenderer` */
  children?: ReactNode;
}

export interface DataTableGroupCellProps<TRow = RowWithKey, TSummaryRow = unknown> {
  /** The grouping value for this group header row */
  groupKey: unknown;
  /** Leaf rows belonging to this group */
  childRows: TRow[];
  isExpanded: boolean;
  toggleGroup: () => void;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  /** Underlying TanStack grouped row */
  tanstackRow: Row<TRow>;
}

export interface DataTableSummaryCellProps<TRow = RowWithKey, TSummaryRow = unknown> {
  row: TSummaryRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
}

export interface DataTableEditorProps<TRow = RowWithKey, TSummaryRow = unknown> {
  row: TRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  rowIndex: number;
  colIndex: number;
  /** Commit a row change; pass `true` to also commit (close) the editor. Mirrors rdg `onRowChange`. */
  onRowChange: (row: TRow, commitChanges?: boolean) => void;
  /** Close the editor. Mirrors rdg `onClose(commitChanges?, shouldFocusCell?)`. */
  onClose: (commitChanges?: boolean, shouldFocusCell?: boolean) => void;
}

export interface ColumnEditorOptions {
  /** When true, clicking outside the editor commits + closes. When false, it is ignored. */
  commitOnOutsideClick?: boolean;
  /** When true, the underlying cell content remains visible behind/around the popover editor */
  displayCellContent?: boolean;
}

/** Context passed to a column's `colSpan` resolver (discriminated so `row` is present for ROW/SUMMARY).
 * GROUP is the group-header row; its `row` is the group's first child (representative), or undefined for
 * an empty group. Resolving GROUP separately lets a column span in the header without affecting data rows. */
export type ColSpanArgs<TRow = RowWithKey> =
  | { type: 'HEADER'; row?: undefined }
  | { type: 'ROW'; row: TRow }
  | { type: 'SUMMARY'; row: TRow }
  // `groupingColumnId` is the column that grouped THIS header's level — lets a column span the header only
  // at its own level (e.g. multi-level grouping where each level's grouping column spans the full row).
  | { type: 'GROUP'; row?: TRow; groupingColumnId?: string };

// ─────────────────────────────────────────────────────────────────────────────
// The public, author-facing column definition (detached from react-data-grid `Column`)
// ─────────────────────────────────────────────────────────────────────────────

export interface ColumnWithFilter<TRow = RowWithKey, TSummaryRow = unknown> {
  /** Unique column id; maps to TanStack `ColumnDef.id` / accessor. */
  key: string;
  /** Header label / content. */
  name: string | ReactNode;

  // sizing
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;

  // behavior
  sortable?: boolean;
  draggable?: boolean;
  /** Pin to the left (sticky) — used for the actions column. */
  frozen?: boolean;
  /** Column id this column is grouped under, or a flag to allow grouping. */
  cellClass?: string | ((row: TRow) => string | null | undefined);
  headerCellClass?: string;
  summaryCellClass?: string | ((row: TSummaryRow) => string | null | undefined);

  /** Data accessor used for sorting, filtering, global search, and copy. */
  getValue?: (params: { row: TRow; column: ColumnWithFilter<TRow, TSummaryRow> }) => string | null;
  /** Filter UIs this column supports. */
  filters?: FilterType[];

  // rendering
  renderCell?: (props: DataTableCellProps<TRow, TSummaryRow>) => ReactNode;
  renderHeaderCell?: (props: DataTableHeaderProps<TRow, TSummaryRow>) => ReactNode;
  renderGroupCell?: (props: DataTableGroupCellProps<TRow, TSummaryRow>) => ReactNode;
  renderSummaryCell?: (props: DataTableSummaryCellProps<TRow, TSummaryRow>) => ReactNode;
  colSpan?: (args: ColSpanArgs<TRow>) => number | undefined;

  // editing
  editable?: boolean | ((row: TRow) => boolean);
  renderEditCell?: (props: DataTableEditorProps<TRow, TSummaryRow>) => ReactNode;
  editorOptions?: ColumnEditorOptions;

  /** Opaque per-column bag for consumers (e.g. Salesforce Field describe). The grid never reads this. */
  meta?: Record<string, unknown>;
}

export type DefaultColumnOptions<TRow = RowWithKey, TSummaryRow = unknown> = Partial<
  Pick<ColumnWithFilter<TRow, TSummaryRow>, 'minWidth' | 'maxWidth' | 'width' | 'resizable' | 'sortable' | 'draggable'>
>;

export interface SalesforceQueryColumnDefinition<TRow, TSummaryRow = unknown> {
  parentColumns: ColumnWithFilter<TRow, TSummaryRow>[];
  subqueryColumns: Record<string, ColumnWithFilter<TRow, TSummaryRow>[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Imperative ref API (unchanged signatures)
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableRef<T> {
  hasSortApplied: () => boolean;
  getFilteredAndSortedRows: () => readonly T[];
  hasReorderedColumns: () => boolean;
  /** Takes into account re-ordered columns */
  getCurrentColumns: () => ColumnWithFilter<T>[];
  /** Takes into account re-ordered columns */
  getCurrentColumnNames: () => string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts shared with renderers / filters (unchanged shapes)
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterContextProps {
  filterSetValues: Record<string, string[]>;
  filters: Record<string, DataTableFilter[]>;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export interface SubqueryContext<TRow = any> {
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  org: SalesforceOrgUi;
  isTooling: boolean;
  columnDefinitions?: Record<string, ColumnWithFilter<TRow, unknown>[]>;
  onSubqueryFieldReorder?: (columnKey: string, fields: string[], columnOrder: number[]) => void;
  hasGoogleDriveAccess: boolean;
  googleShowUpgradeToPro: boolean;
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

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────

export type ContextAction =
  | 'COPY_CELL'
  | 'COPY_ROW_EXCEL'
  | 'COPY_ROW_JSON'
  | 'COPY_COL'
  | 'COPY_COL_JSON'
  | 'COPY_COL_NO_HEADER'
  | 'COPY_TABLE'
  | 'COPY_TABLE_JSON'
  | 'COPY_TABLE_CSV'
  | 'VIEW_FIELD_METADATA';

export type ContextMenuActionData<T> = {
  row: T;
  rows: T[];
  rowIdx: number;
  column: ColumnWithFilter<T, unknown>;
  columns: ColumnWithFilter<T, unknown>[];
};

/**
 * Context-menu items: either a static list, or a builder evaluated against the right-clicked cell so the
 * menu can be cell/column/group-aware (e.g. "Copy column (Apex Classes)"). Returning `[]` suppresses the
 * custom menu for that cell (the native browser menu is allowed through). Builders run for data-row
 * right-clicks; column-header right-clicks use the static list (filtered to column-scoped actions).
 */
export type ContextMenuItems<T> = ContextMenuItem[] | ((data: ContextMenuActionData<T>) => ContextMenuItem[]);

// ─────────────────────────────────────────────────────────────────────────────
// Internal: meta carried on TanStack `ColumnDef.meta` so presentational components can
// reach author intent. `cellKind` replaces the legacy `dataTableRenderFnMap` identity trick.
// ─────────────────────────────────────────────────────────────────────────────

export type CellKind = 'data' | 'select' | 'action' | 'rowheader';

export interface JetstreamColumnMeta<TRow = RowWithKey, TSummaryRow = unknown> {
  /** The original author-facing column, passed back to renderers/editors. */
  column: ColumnWithFilter<TRow, TSummaryRow>;
  filters?: FilterType[];
  frozen?: boolean;
  cellKind: CellKind;
  cellClass?: ColumnWithFilter<TRow, TSummaryRow>['cellClass'];
  colSpan?: ColumnWithFilter<TRow, TSummaryRow>['colSpan'];
  renderGroupCell?: ColumnWithFilter<TRow, TSummaryRow>['renderGroupCell'];
  renderSummaryCell?: ColumnWithFilter<TRow, TSummaryRow>['renderSummaryCell'];
  editor?: ColumnWithFilter<TRow, TSummaryRow>['renderEditCell'];
  editable?: ColumnWithFilter<TRow, TSummaryRow>['editable'];
  editorOptions?: ColumnEditorOptions;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    jetstream?: JetstreamColumnMeta<TData>;
  }
  // Expose our table on the cell/header context without per-call casts
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface TableMeta<TData extends RowData> {
    gridId?: string;
  }
}

export type { Header, Row, Table };
