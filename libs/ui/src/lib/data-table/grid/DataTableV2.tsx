/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem, SalesforceOrgUi } from '@jetstream/types';
import { ExpandedState, RowSelectionState } from '@tanstack/react-table';
import { forwardRef, useCallback, useMemo } from 'react';
import { RowHeightFn } from './components/GridBody';
import { GridContainer } from './components/GridContainer';
import { useJetstreamTable } from './core/useJetstreamTable';
import './data-table-grid.css';
import { GridFilterContext, GridGenericContext, GridRecordActionContext } from './grid-context';
import { getSortedFilteredLeafRows } from './grid-row-utils';
import {
  ColumnWithFilter,
  ContextMenuActionData,
  ContextMenuItems,
  DataTableRef,
  DefaultColumnOptions,
  GridCellRef,
  PasteEvent,
  RowWithKey,
  SortColumn,
} from './grid-types';

export interface DataTableV2Props<TRow = RowWithKey, TContext = Record<string, any>> {
  data: TRow[];
  columns: ColumnWithFilter<TRow>[];
  getRowKey: (row: TRow) => string;
  org?: SalesforceOrgUi;
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  context?: TContext;
  initialSortColumns?: SortColumn[];
  defaultColumnOptions?: DefaultColumnOptions<TRow>;
  rowAlwaysVisible?: (row: TRow) => boolean;
  ignoreRowInSetFilter?: (row: TRow) => boolean;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly TRow[]) => void;
  onSortColumnsChange?: (sortColumns: SortColumn[]) => void;
  /** Called when an inline edit commits; `rows` are the current display rows with the edit applied. */
  onRowsChange?: (rows: TRow[], data: { indexes: number[]; column: ColumnWithFilter<TRow> }) => void;
  /** Called when the user pastes into the selection (Ctrl/Cmd+V or the context-menu Paste item). */
  onPaste?: (event: PasteEvent) => void;
  /** Undo the last edit/paste (Ctrl/Cmd+Z); the consumer owns the row-snapshot history. */
  onUndo?: () => void;
  /** Redo the last undone edit (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y). */
  onRedo?: () => void;
  /** Revert the given modified cells to their original values (context-menu "Revert"). */
  onRevertCells?: (cells: GridCellRef[]) => void;
  /** Whether a cell holds an unsaved modification — gates the context-menu "Revert" item. */
  isCellDirty?: (rowId: string, columnId: string) => boolean;
  /** Seed row height for the virtualizer (actual heights are measured dynamically). Either a fixed
   * number or a per-row callback that distinguishes group rows from data rows. */
  rowHeight?: number | RowHeightFn<TRow>;
  rowClass?: (row: TRow) => string | undefined;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Allow shift-click on headers to add secondary sorts (legacy grid parity). */
  enableMultiSort?: boolean;
  ariaLabel?: string;
  className?: string;
  // ── Grouping / tree ──
  role?: 'grid' | 'treegrid';
  /** Column keys to group rows by (creates group header rows). */
  grouping?: string[];
  /** For genuine parent→child hierarchy: return a row's child rows. */
  getSubRows?: (row: TRow, index: number) => TRow[] | undefined;
  expanded?: ExpandedState;
  onExpandedChange?: (expanded: ExpandedState) => void;
  /** Initial expanded state when uncontrolled — `true` expands all groups/rows. */
  defaultExpanded?: ExpandedState | boolean;
  /** Pinned summary rows rendered below the header. */
  summaryRows?: unknown[];
  /** Fixed height (px) for each pinned summary row; content-sized when omitted. */
  summaryRowHeight?: number;
  /** Right-click context menu items — a static list or a per-cell builder (must be stable). */
  contextMenuItems?: ContextMenuItems<TRow>;
  /** Right-click context menu action handler (must be stable). */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<TRow>) => void;
  /** Consumer-supplied builder for extra per-column header menu items (must be stable). */
  getColumnHeaderMenuItems?: (columnId: string) => ContextMenuItem[];
  /** Opt-in: rows wrap and size to their content (DOM-measured); disables column virtualization so every
   * row's height accounts for all cells. Use only for grids whose columns fit without horizontal scroll. */
  autoRowHeight?: boolean;
}

function DataTableV2Inner<TRow extends object = RowWithKey>(props: DataTableV2Props<TRow>, ref: React.Ref<DataTableRef<TRow>>) {
  const {
    data,
    columns,
    getRowKey,
    org,
    serverUrl,
    skipFrontdoorLogin,
    quickFilterText,
    includeQuickFilter,
    context,
    initialSortColumns,
    defaultColumnOptions,
    rowAlwaysVisible,
    ignoreRowInSetFilter,
    onReorderColumns,
    onSortedAndFilteredRowsChange,
    onSortColumnsChange,
    onRowsChange,
    onPaste,
    onUndo,
    onRedo,
    onRevertCells,
    isCellDirty,
    rowHeight,
    rowClass,
    enableRowSelection,
    rowSelection,
    onRowSelectionChange,
    enableMultiSort,
    ariaLabel,
    className,
    role,
    grouping,
    getSubRows,
    expanded,
    onExpandedChange,
    defaultExpanded,
    summaryRows,
    summaryRowHeight,
    contextMenuItems,
    contextMenuAction,
    getColumnHeaderMenuItems,
    autoRowHeight,
  } = props;

  const { table, gridId, orderedColumns, filters, filterSetValues, updateFilter, registerEditedValues } = useJetstreamTable<TRow>({
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
    rowSelection,
    onRowSelectionChange,
    enableMultiSort,
    onReorderColumns,
    onSortedAndFilteredRowsChange,
    onSortColumnsChange,
    grouping,
    getSubRows,
    expanded,
    onExpandedChange,
    defaultExpanded,
  });

  // Keep a freshly edited value selected under an active SET filter so the edited row doesn't vanish
  // from view (legacy ADD_MODIFIED_VALUE_TO_SET_FILTER behavior), then forward the commit.
  const handleRowsChange = useCallback(
    (rows: TRow[], data: { indexes: number[]; column: ColumnWithFilter<TRow> }) => {
      registerEditedValues(
        data.column.key,
        data.indexes.map((index) => (rows[index] as Record<string, unknown>)?.[data.column.key]),
      );
      onRowsChange?.(rows, data);
    },
    [onRowsChange, registerEditedValues],
  );

  const filterContextValue = useMemo(() => ({ filterSetValues, filters, updateFilter }), [filterSetValues, filters, updateFilter]);

  // Stable record-action context for the high-cardinality id/name link cells. The generic context bag
  // below carries a volatile `rows` array (rebuilt on every data/sort/filter change), and because a
  // cell's `useContext` subscribes its owning GridCell, reading these stable values from there forced
  // every link/popover cell to re-render on each keystroke. Key the memo on `onRecordAction`'s identity
  // (not the whole `context` object) so an inline `context={{...}}` at a call site can't churn it.
  const onRecordAction = (context as Record<string, any> | undefined)?.onRecordAction;
  const recordActionContextValue = useMemo(
    () => ({ org, serverUrl, skipFrontdoorLogin, onRecordAction }),
    [org, serverUrl, skipFrontdoorLogin, onRecordAction],
  );

  // The legacy DataTable exposed the filtered+sorted rows on the generic context; several consumers
  // (e.g. permission-manager's ColumnSearchFilterSummary / BulkActionRenderer) still read `rows`, so
  // keep providing them or those components crash on `rows.filter(...)` of undefined. Uses the
  // collapse-independent leaf rows — group rows would duplicate each group's first child and
  // collapsing a group would shrink the list (both corrupt "Showing X of Y" and bulk actions).
  const sortedFlatRows = table.getSortedRowModel().flatRows;
  const genericContextValue = useMemo(
    () => ({
      ...context,
      org,
      serverUrl,
      skipFrontdoorLogin,
      columns: orderedColumns,
      rows: getSortedFilteredLeafRows(table).map((row) => row.original),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, org, serverUrl, skipFrontdoorLogin, orderedColumns, sortedFlatRows],
  );

  return (
    <GridRecordActionContext.Provider value={recordActionContextValue}>
      <GridGenericContext.Provider value={genericContextValue}>
        <GridFilterContext.Provider value={filterContextValue}>
          <GridContainer
            table={table}
            gridId={gridId}
            getRowKey={getRowKey}
            orderedColumns={orderedColumns}
            role={role ?? (grouping?.length || getSubRows ? 'treegrid' : 'grid')}
            ariaLabel={ariaLabel}
            className={className}
            rowHeight={rowHeight}
            rowClass={rowClass}
            onRowsChange={onRowsChange ? handleRowsChange : undefined}
            onPaste={onPaste}
            onUndo={onUndo}
            onRedo={onRedo}
            onRevertCells={onRevertCells}
            isCellDirty={isCellDirty}
            summaryRows={summaryRows}
            summaryRowHeight={summaryRowHeight}
            contextMenuItems={contextMenuItems}
            contextMenuAction={contextMenuAction}
            getColumnHeaderMenuItems={getColumnHeaderMenuItems}
            autoRowHeight={autoRowHeight}
          />
        </GridFilterContext.Provider>
      </GridGenericContext.Provider>
    </GridRecordActionContext.Provider>
  );
}

export const DataTableV2 = forwardRef(DataTableV2Inner) as <TRow extends object = RowWithKey>(
  props: DataTableV2Props<TRow> & { ref?: React.Ref<DataTableRef<TRow>> },
) => React.ReactElement;
