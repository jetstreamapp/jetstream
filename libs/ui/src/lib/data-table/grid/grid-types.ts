/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem, Maybe, QueryResult, SalesforceOrgUi } from '@jetstream/types';
import type { Cell, CellData, Column, ColumnDef, FilterFn, Header, Row, RowData, Table, TableFeatures } from '@tanstack/react-table';
import { ReactNode } from 'react';
import type { JetstreamTableFeatures } from './grid-features';

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

// ─────────────────────────────────────────────────────────────────────────────
// TanStack type aliases. v9 threads a `TFeatures` generic through every table type; these aliases
// bake in Jetstream's single shared feature set so the rest of the grid never spells it out.
// ("Tanstack*" naming matches the existing `tanstackRow` prop vocabulary and avoids colliding with
// the GridRow/GridCell/GridHeader components.)
// ─────────────────────────────────────────────────────────────────────────────

export type TanstackTable<TRow extends object = RowWithKey> = Table<JetstreamTableFeatures, TRow>;
export type TanstackRow<TRow extends object = RowWithKey> = Row<JetstreamTableFeatures, TRow>;
export type TanstackColumn<TRow extends object = RowWithKey, TValue = unknown> = Column<JetstreamTableFeatures, TRow, TValue>;
export type TanstackHeader<TRow extends object = RowWithKey, TValue extends CellData = CellData> = Header<
  JetstreamTableFeatures,
  TRow,
  TValue
>;
export type TanstackCell<TRow extends object = RowWithKey, TValue extends CellData = CellData> = Cell<JetstreamTableFeatures, TRow, TValue>;
export type TanstackColumnDef<TRow extends object = RowWithKey> = ColumnDef<JetstreamTableFeatures, TRow>;
export type TanstackFilterFn<TRow extends object = any> = FilterFn<JetstreamTableFeatures, TRow>;

/**
 * The subset of the TanStack row surface exposed to cell renderers via the `tanstackRow` escape
 * hatch. Deliberately NOT the full v9 `Row` type: v9 rows are invariant in their data generic, so
 * `DataTableCellProps<ConcreteRow>` would stop being assignable to `DataTableCellProps<any>` —
 * breaking the spreadable-column pattern (`SelectColumn.renderCell?.(args)`) used across feature
 * code. Every member here keeps `TRow` in a variance-safe position; widen this interface if a
 * renderer needs more of the row.
 */
export interface GridRowHandle<TRow extends object = RowWithKey> {
  id: string;
  depth: number;
  original: TRow;
  /** Set when this is a group header row — the column id this row's level is grouped by. */
  groupingColumnId?: string;
  getCanSelect: () => boolean;
  getIsSelected: () => boolean;
  /** "Some but not all descendants selected" (row-level semantics are unchanged in v9). */
  getIsSomeSelected: () => boolean;
  getIsAllSubRowsSelected: () => boolean;
  toggleSelected: (value?: boolean) => void;
  /** v9 handler: tracks the range-selection anchor and applies Shift ranges internally. */
  getToggleSelectedHandler: () => (event: unknown) => void;
  getCanExpand: () => boolean;
  getIsExpanded: () => boolean;
  toggleExpanded: (expanded?: boolean) => void;
}

export type RowSalesforceRecordWithKey = RowWithKey & {
  _action: (row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'delete' | 'undelete' | 'apex') => void;
  _idx: number;
  _record: Record<string, any>;
  _touchedColumns: Set<string>;
  /**
   * Blocking errors keyed by column key. Populated by client-side validation (e.g. value too long) AND by
   * post-save Salesforce errors that mapped to a visible column. Cells with an entry render a red ring.
   */
  _fieldErrors?: Record<string, string>;
  /** Non-blocking warnings keyed by column key (e.g. inactive picklist value, paste coercion). Amber ring. */
  _fieldWarnings?: Record<string, string>;
  /** General/row-level errors: Salesforce errors with empty `fields[]` or referencing a non-visible column. */
  _recordErrors?: string[];
  /** Derived human-readable summary (join of all field + record errors). Kept for row-level read sites. */
  _saveError?: Maybe<string>;
};

/** Result of validating a single cell value. `error` blocks save; `warning` is advisory only. */
export interface CellValidationResult {
  error?: string;
  warning?: string;
}

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

export type FilterComparator = 'EQUALS' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL';

export interface DataTableNumberFilter {
  type: 'NUMBER';
  value: string | null;
  comparator: FilterComparator;
}

export interface DataTableDateFilter {
  type: 'DATE';
  value: string | null;
  comparator: FilterComparator;
  /**
   * Compare calendar days only, discarding the record's time-of-day. Without this, a record stamped
   * later the same day as the filter date counts as "greater than" it.
   */
  ignoreTimestamp?: boolean;
}

export interface DataTableTimeFilter {
  type: 'TIME';
  value: string;
  comparator: FilterComparator;
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

export interface DataTableCellProps<TRow extends object = RowWithKey, TSummaryRow = unknown> {
  /** Convenience alias for `tanstackRow.original` */
  row: TRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  /** Accessor value for this cell (post `getValue`/`accessorFn`) */
  value: unknown;
  /** Index within the current filtered + sorted (+ flattened) row model */
  rowIndex: number;
  /** rdg-compat alias of rowIndex */
  rowIdx: number;
  /** Escape hatch to the underlying TanStack row (variance-safe subset — see GridRowHandle) */
  tanstackRow: GridRowHandle<TRow>;
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

export interface DataTableHeaderProps<TRow extends object = RowWithKey, TSummaryRow = unknown> {
  column: ColumnWithFilter<TRow, TSummaryRow>;
  sortDirection?: SortDirection;
  /** Sort priority (1-based) when multi-column sorting is active */
  priority?: number;
  header: TanstackHeader<TRow>;
  /** Children-as-function pattern used by `FilterRenderer` */
  children?: ReactNode;
}

export interface DataTableGroupCellProps<TRow extends object = RowWithKey, TSummaryRow = unknown> {
  /** The grouping value for this group header row */
  groupKey: unknown;
  /** Leaf rows belonging to this group */
  childRows: TRow[];
  isExpanded: boolean;
  toggleGroup: () => void;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  /** Underlying TanStack grouped row (variance-safe subset — see GridRowHandle) */
  tanstackRow: GridRowHandle<TRow>;
}

export interface DataTableSummaryCellProps<TRow extends object = RowWithKey, TSummaryRow = unknown> {
  row: TSummaryRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
}

export interface DataTableEditorProps<TRow extends object = RowWithKey, TSummaryRow = unknown> {
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

export interface ColumnWithFilter<TRow extends object = RowWithKey, TSummaryRow = unknown> {
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

export type DefaultColumnOptions<TRow extends object = RowWithKey, TSummaryRow = unknown> = Partial<
  Pick<ColumnWithFilter<TRow, TSummaryRow>, 'minWidth' | 'maxWidth' | 'width' | 'resizable' | 'sortable' | 'draggable'>
>;

export interface SalesforceQueryColumnDefinition<TRow extends object, TSummaryRow = unknown> {
  parentColumns: ColumnWithFilter<TRow, TSummaryRow>[];
  subqueryColumns: Record<string, ColumnWithFilter<TRow, TSummaryRow>[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Imperative ref API (unchanged signatures)
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableRef<T extends object> {
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

/** One level of the subquery drill-down stack — the records being viewed and the record they came from. */
export interface SubqueryLevel<TRow extends object = any> {
  /** Relationship path from the root object, e.x. `Contacts` or `Contacts.Cases` */
  relationshipPath: string;
  /** Relationship name on its own, used as the modal header and breadcrumb label */
  columnKey: string;
  queryResults: QueryResult<TRow>;
  parentRecord: TRow;
}

export interface SubqueryContext<TRow extends object = any> {
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  org: SalesforceOrgUi;
  isTooling: boolean;
  /** Keyed by lowercased relationship path, so a nested subquery resolves independently of a same-named one elsewhere */
  columnDefinitions?: Record<string, ColumnWithFilter<TRow, unknown>[]>;
  onSubqueryFieldReorder?: (relationshipPath: string, fields: string[], columnOrder: number[]) => void;
  hasGoogleDriveAccess: boolean;
  googleShowUpgradeToPro: boolean;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  /**
   * Set only when rendering inside the subquery modal. Its presence is what tells a subquery cell to drill the
   * modal down a level instead of opening its own, so the two fields travel together by construction.
   */
  nestedRender?: {
    /** Relationship path of the subquery currently being rendered */
    relationshipPath: string;
    onDrillDown: (level: SubqueryLevel<TRow>) => void;
  };
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

export type ContextMenuActionData<T extends object> = {
  row: T;
  rows: T[];
  rowIdx: number;
  column: ColumnWithFilter<T, unknown>;
  columns: ColumnWithFilter<T, unknown>[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Paste (clipboard → cells). The grid computes the editable target cells from the active selection +
// parsed clipboard matrix and hands them to the consumer, which owns value coercion + dirty tracking.
// ─────────────────────────────────────────────────────────────────────────────

/** Logical address of a grid cell: stable row key (from `getRowKey`) + author-facing column key. */
export interface GridCellRef {
  /** Stable row key (from the grid's `getRowKey`) so the consumer can locate the row regardless of order. */
  rowKey: string;
  /** Author-facing column key (matches `ColumnWithFilter.key`). */
  columnKey: string;
}

/** A single editable cell that should receive a pasted (raw string) value. */
export interface PasteTargetCell extends GridCellRef {
  /** The raw, un-coerced clipboard string for this cell. */
  value: string;
}

/** Emitted by the grid when the user pastes; the consumer applies `cells` to its row state. */
export interface PasteEvent {
  cells: PasteTargetCell[];
  /** Count of in-range cells that were skipped because they were not editable (read-only / group rows). */
  skippedCount: number;
  /** Why the cells changed — a real paste, or a Delete/Backspace clear (both flow through `onPaste`). */
  source?: 'paste' | 'clear';
}

/**
 * Context-menu items: either a static list, or a builder evaluated against the right-clicked cell so the
 * menu can be cell/column/group-aware (e.g. "Copy column (Apex Classes)"). Returning `[]` suppresses the
 * custom menu for that cell (the native browser menu is allowed through). Builders run for data-row
 * right-clicks; column-header right-clicks use the static list (filtered to column-scoped actions).
 */
export type ContextMenuItems<T extends object> = ContextMenuItem[] | ((data: ContextMenuActionData<T>) => ContextMenuItem[]);

// ─────────────────────────────────────────────────────────────────────────────
// Internal: meta carried on TanStack `ColumnDef.meta` so presentational components can
// reach author intent. `cellKind` replaces the legacy `dataTableRenderFnMap` identity trick.
// ─────────────────────────────────────────────────────────────────────────────

export type CellKind = 'data' | 'select' | 'action' | 'rowheader';

export interface JetstreamColumnMeta<TRow extends object = RowWithKey, TSummaryRow = unknown> {
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
  // Generic lists must mirror v9's declarations exactly (arity, constraints, variance) or the merge fails.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData = CellData> {
    jetstream?: JetstreamColumnMeta<TData>;
  }
  // Expose our table on the cell/header context without per-call casts
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<in out TFeatures extends TableFeatures, in out TData extends RowData> {
    gridId?: string;
  }
}
