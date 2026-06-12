/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMenuItem, SalesforceOrgUi } from '@jetstream/types';
import { RowSelectionState } from '@tanstack/react-table';
import { forwardRef, useMemo } from 'react';
import { DataTableV2, DataTableV2Props } from './grid/DataTableV2';
import { ColumnWithFilter, ContextMenuActionData, DataTableRef, DefaultColumnOptions, RowWithKey, SortColumn } from './grid/grid-types';

/**
 * Public flat data table. Thin wrapper over the new headless-TanStack grid (DataTableV2) that preserves
 * the legacy prop surface (selectedRows Set, rowHeight number|fn, topSummaryRows, etc.) so call sites
 * migrate with no code changes.
 */
export interface DataTableProps<T = RowWithKey, TContext = Record<string, any>> {
  data: T[];
  columns: ColumnWithFilter<T>[];
  getRowKey: (row: T) => string;
  org?: SalesforceOrgUi;
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  context?: TContext;
  contextMenuItems?: ContextMenuItem[];
  // `any` so call sites may type their handler against a narrower row type without variance errors.
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<any>) => void;
  initialSortColumns?: SortColumn[];
  rowAlwaysVisible?: (row: T) => boolean;
  ignoreRowInSetFilter?: (row: T) => boolean;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly T[]) => void;
  onSortColumnsChange?: (sortColumns: SortColumn[]) => void;
  onRowsChange?: (rows: T[], data: { indexes: number[]; column: ColumnWithFilter<T> }) => void;
  /** Fixed numeric row height, or a per-row callback `({ type: 'ROW' | 'GROUP', row }) => number`.
   * The callback seeds the virtualizer's initial size estimate; actual heights are then measured
   * dynamically once rendered. */
  rowHeight?: number | ((args: { type: 'ROW' | 'GROUP'; row: T }) => number);
  rowClass?: (row: T) => string | undefined;
  selectedRows?: ReadonlySet<any>;
  onSelectedRowsChange?: (selectedRows: Set<string>) => void;
  /** Pinned summary rows rendered below the header (legacy `topSummaryRows`). */
  topSummaryRows?: any[];
  summaryRowHeight?: number;
  defaultColumnOptions?: DefaultColumnOptions<T>;
  className?: string;
  'aria-label'?: string;
}

/** Map the legacy DataTable/DataTree prop surface onto DataTableV2 props (selection Set↔Record, etc.). */
export function useMappedV2Props<T extends object = RowWithKey>(props: DataTableProps<T>): DataTableV2Props<T> {
  const { selectedRows, onSelectedRowsChange, topSummaryRows, summaryRowHeight, defaultColumnOptions, ...rest } = props as any;

  const rowSelection = useMemo<RowSelectionState | undefined>(() => {
    if (!selectedRows) {
      return undefined;
    }
    const record: RowSelectionState = {};
    selectedRows.forEach((key: string) => (record[key] = true));
    return record;
  }, [selectedRows]);

  const handleRowSelectionChange = useMemo(() => {
    if (!onSelectedRowsChange) {
      return undefined;
    }
    return (record: RowSelectionState) => onSelectedRowsChange(new Set(Object.keys(record).filter((key) => record[key])));
  }, [onSelectedRowsChange]);

  // The legacy wrappers always injected these defaults before handing columns to react-data-grid;
  // most call sites rely on them rather than flagging each column.
  const mergedDefaultColumnOptions = useMemo<DefaultColumnOptions<T>>(
    () => ({ resizable: true, sortable: true, ...defaultColumnOptions }),
    [defaultColumnOptions],
  );

  return {
    ...rest,
    ariaLabel: props['aria-label'],
    enableRowSelection: !!(selectedRows || onSelectedRowsChange),
    rowSelection,
    onRowSelectionChange: handleRowSelectionChange,
    defaultColumnOptions: mergedDefaultColumnOptions,
    // Legacy react-data-grid allowed adding secondary sorts with a modifier-click.
    enableMultiSort: true,
    summaryRows: topSummaryRows,
    summaryRowHeight,
  } as DataTableV2Props<T>;
}

function DataTableInner<T extends object = RowWithKey>(props: DataTableProps<T>, ref: React.Ref<DataTableRef<T>>) {
  const mapped = useMappedV2Props(props);
  return <DataTableV2<T> {...mapped} ref={ref} role="grid" />;
}

export const DataTable = forwardRef(DataTableInner) as unknown as <T extends object = RowWithKey>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableRef<T>> },
) => React.ReactElement;
