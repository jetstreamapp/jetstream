import { SalesforceOrgUi } from '@jetstream/types';
import { forwardRef } from 'react';
import { TreeDataGrid, TreeDataGridProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { ContextMenuContext, ContextMenuItem } from '../popover/ContextMenu';
import { DataTableFilterContext, DataTableGenericContext } from './data-table-context';
import './data-table-styles.scss';
import { ColumnWithFilter, ContextMenuActionData, RowWithKey } from './data-table-types';
import { useDataTable } from './useDataTable';

interface PropsWithServer {
  serverUrl: string;
  skipFrontdoorLogin: boolean;
}

interface PropsWithoutServer {
  serverUrl?: never;
  skipFrontdoorLogin?: never;
}

export type DataTreeProps<T = RowWithKey, TContext = Record<string, any>> = DataTreePropsBase<T, TContext> &
  (PropsWithServer | PropsWithoutServer);

interface DataTreePropsBase<T = RowWithKey, TContext = Record<string, any>>
  extends Omit<TreeDataGridProps<T>, 'columns' | 'rows' | 'rowKeyGetter'> {
  data: T[];
  columns: ColumnWithFilter<T>[];
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  org?: SalesforceOrgUi;
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  context?: TContext;
  /** Must be stable to avoid constant re-renders */
  contextMenuItems?: ContextMenuItem[];
  /** Must be stable to avoid constant re-renders */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<T>) => void;
  getRowKey: (row: T) => string;
  rowAlwaysVisible?: (row: T) => boolean;
  ignoreRowInSetFilter?: (row: T) => boolean;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly T[]) => void;
}

export const DataTree = forwardRef<any, DataTreeProps<any>>(
  <T extends object>(
    {
      data,
      columns: _columns,
      serverUrl,
      skipFrontdoorLogin,
      org,
      quickFilterText,
      includeQuickFilter,
      context,
      contextMenuItems,
      contextMenuAction,
      getRowKey,
      ignoreRowInSetFilter,
      rowAlwaysVisible,
      onReorderColumns,
      onSortedAndFilteredRowsChange,
      ...rest
    }: DataTreeProps<T>,
    ref
  ) => {
    const {
      gridId,
      columns,
      sortColumns,
      renderers,
      filters,
      reorderedColumns,
      filterSetValues,
      filteredRows,
      setSortColumns,
      updateFilter,
      handleReorderColumns,
      handleCellKeydown,
    } = useDataTable({
      data,
      columns: _columns,
      serverUrl,
      skipFrontdoorLogin,
      org,
      quickFilterText,
      includeQuickFilter,
      contextMenuItems,
      ref,
      contextMenuAction,
      getRowKey,
      ignoreRowInSetFilter,
      rowAlwaysVisible,
      onReorderColumns,
      onSortedAndFilteredRowsChange,
    });

    return (
      <ContextMenuContext.Provider value={new Map()}>
        <DataTableGenericContext.Provider value={{ ...context, rows: filteredRows, columns }}>
          <DataTableFilterContext.Provider
            value={{
              filterSetValues,
              filters,
              portalRefForFilters: context?.portalRefForFilters,
              updateFilter,
            }}
          >
            <TreeDataGrid
              data-id={gridId}
              className="rdg-light fill-grid"
              columns={reorderedColumns}
              rows={filteredRows}
              renderers={renderers}
              sortColumns={sortColumns}
              onSortColumnsChange={setSortColumns}
              rowKeyGetter={getRowKey}
              defaultColumnOptions={{ resizable: true, sortable: true, ...rest.defaultColumnOptions }}
              onCellKeyDown={handleCellKeydown}
              onColumnsReorder={handleReorderColumns}
              {...rest}
            />
          </DataTableFilterContext.Provider>
        </DataTableGenericContext.Provider>
      </ContextMenuContext.Provider>
    );
  }
);
