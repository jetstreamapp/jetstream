import { ContextMenuItem, SalesforceOrgUi } from '@jetstream/types';
import { forwardRef } from 'react';
import DataGrid, { DataGridProps, SortColumn } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { ContextMenu } from '../form/context-menu/ContextMenu';
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
      contextMenuProps,
      setSortColumns,
      updateFilter,
      handleReorderColumns,
      handleCellKeydown,
      handleCellContextMenu,
      handleCloseContextMenu,
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
            // @ts-expect-error Types are incorrect, but they are generic and difficult to get correct
            renderers={renderers}
            sortColumns={sortColumns}
            onSortColumnsChange={setSortColumns}
            // @ts-expect-error Types are incorrect, but they are generic and difficult to get correct
            rowKeyGetter={getRowKey}
            defaultColumnOptions={{ resizable: true, sortable: true, ...rest.defaultColumnOptions } as any}
            // @ts-expect-error Types are incorrect, but they are generic and difficult to get correct
            onCellKeyDown={handleCellKeydown}
            onColumnsReorder={handleReorderColumns}
            // @ts-expect-error Types are incorrect, but they are generic and difficult to get correct
            onCellContextMenu={handleCellContextMenu}
            {...rest}
          />
          {contextMenuProps && contextMenuItems && contextMenuAction && (
            <ContextMenu
              parentElement={contextMenuProps.element}
              items={contextMenuItems}
              onSelected={(item) => {
                contextMenuAction(item, {
                  row: filteredRows[contextMenuProps.rowIdx] as T,
                  rowIdx: contextMenuProps.rowIdx,
                  rows: filteredRows as T[],
                  column: columns[contextMenuProps.rowIdx],
                  columns,
                });
                handleCloseContextMenu();
              }}
              onClose={handleCloseContextMenu}
            />
          )}
        </DataTableFilterContext.Provider>
      </DataTableGenericContext.Provider>
    );
  }
);
