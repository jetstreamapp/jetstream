import { SalesforceOrgUi } from '@jetstream/types';
import { forwardRef } from 'react';
import DataGrid, { DataGridProps, SortColumn } from 'react-data-grid';
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

export type DataTableProps<T = RowWithKey, TContext = Record<string, any>> = DataTablePropsBase<T, TContext> &
  (PropsWithServer | PropsWithoutServer);

interface DataTablePropsBase<T = RowWithKey, TContext = Record<string, any>>
  extends Omit<DataGridProps<T>, 'columns' | 'rows' | 'rowKeyGetter' | 'onColumnsReorder'> {
  data: T[];
  columns: ColumnWithFilter<T>[];
  org?: SalesforceOrgUi;
  // Both of these are required if one is present, since the server url is most likely used for frontdoor login
  // serverUrl
  // skipFrontdoorLogin
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  context?: TContext;
  /** Must be stable to avoid constant re-renders */
  contextMenuItems?: ContextMenuItem[];
  initialSortColumns?: SortColumn[];
  /** Must be stable to avoid constant re-renders */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<T>) => void;
  getRowKey: (row: T) => string;
  rowAlwaysVisible?: (row: T) => boolean;
  ignoreRowInSetFilter?: (row: T) => boolean;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly T[]) => void;
}

export const DataTable = forwardRef<any, DataTableProps<any>>(
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
      initialSortColumns,
      contextMenuAction,
      getRowKey,
      ignoreRowInSetFilter,
      rowAlwaysVisible,
      onReorderColumns,
      onSortedAndFilteredRowsChange,
      ...rest
    }: DataTableProps<T>,
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
      initialSortColumns,
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
            <DataGrid
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
