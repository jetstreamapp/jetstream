import { IconName } from '@jetstream/icon-factory';
import { logger } from '@jetstream/shared/client-logger';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { orderObjectsBy, orderStringsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { uniqueId } from 'lodash';
import escapeRegExp from 'lodash/escapeRegExp';
import isNil from 'lodash/isNil';
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useReducer, useState } from 'react';
import DataGrid, {
  DataGridProps,
  HeaderRendererProps,
  Renderers,
  Row as GridRow,
  RowRendererProps,
  SortColumn,
  SortStatusProps,
} from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import ContextMenu, { ContextMenuContext, ContextMenuItem } from '../popover/ContextMenu';
import Icon from '../widgets/Icon';
import { DataTableFilterContext, DataTableGenericContext } from './data-table-context';
import './data-table-styles.scss';
import { ColumnWithFilter, ContextMenuActionData, DataTableFilter, FILTER_SET_TYPES, RowWithKey } from './data-table-types';
import { EMPTY_FIELD, filterRecord, getSearchTextByRow, isFilterActive, NON_DATA_COLUMN_KEYS, resetFilter } from './data-table-utils';
import { configIdLinkRenderer, DraggableHeaderRenderer } from './DataTableRenderers';

function sortStatus({ sortDirection, priority }: SortStatusProps) {
  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';
  return sortDirection !== undefined ? (
    <>
      <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-icon_xx-small" />
      <span>{priority}</span>
    </>
  ) : null;
}

interface ContextMenuRendererProps {
  containerId?: string;
  props: RowRendererProps<any>;
  contextMenuItems: ContextMenuItem[];
  contextMenuAction: (item: ContextMenuItem, data: ContextMenuActionData<unknown>) => void;
}

function ContextMenuRenderer({ containerId, props, contextMenuItems, contextMenuAction }: ContextMenuRendererProps) {
  const { columns, rows } = useContext(DataTableGenericContext);
  return (
    <ContextMenu
      containerId={containerId}
      menu={contextMenuItems}
      onItemSelected={(item) => {
        if (!props.selectedCellIdx) {
          return;
        }
        contextMenuAction(item, {
          row: props.row,
          rowIdx: props.rowIdx,
          rows,
          column: columns[props.selectedCellIdx],
          columns,
        });
      }}
    >
      <GridRow data-id={containerId} {...props} />
    </ContextMenu>
  );
}

interface State<T> {
  columnMap: Map<string, ColumnWithFilter<T>>;
  filters: Record<string, DataTableFilter[]>;
  filterSetValues: Record<string, string[]>;
}

type Action =
  | { type: 'INIT'; payload: { columns: ColumnWithFilter<any>[]; data: any[]; ignoreRowInSetFilter?: (row: any) => boolean } }
  | { type: 'UPDATE_FILTER'; payload: { column: string; filter: DataTableFilter } };

// Reducer is used to limit the number of re-renders because of dependent state
function reducer<T>(state: State<T>, action: Action): State<T> {
  switch (action.type) {
    case 'INIT': {
      const { columns, data, ignoreRowInSetFilter } = action.payload;

      const columnMap = new Map(columns.map((column) => [column.key, column]));

      const filters = columns.reduce((acc: Record<string, DataTableFilter[]>, column) => {
        if (Array.isArray(column.filters)) {
          acc[column.key] = column.filters.map((filter) => resetFilter(filter, []));
        }
        return acc;
      }, {});

      // NOTICE: This function mutates filters
      const filterSetValues = Object.keys(filters)
        .filter((columnKey) => Array.isArray(filters[columnKey]) && filters[columnKey].some(({ type }) => FILTER_SET_TYPES.has(type)))
        .reduce((acc: Record<string, string[]>, columnKey) => {
          const filter = filters[columnKey].find(({ type }) => FILTER_SET_TYPES.has(type));
          const column = columnMap.get(columnKey);
          const getValueFn = columnMap.get(columnKey)?.getValue || (({ row, column }) => row[columnKey]);
          if (!filter || !column) {
            return acc;
          }
          if (filter.type === 'BOOLEAN_SET') {
            acc[columnKey] = ['True', 'False'];
          } else {
            acc[columnKey] = orderStringsBy(
              Array.from(
                new Set(
                  data
                    .filter((row) => (ignoreRowInSetFilter ? !ignoreRowInSetFilter(row) : true))
                    .map((row) => {
                      const rowValue = getValueFn({ row, column });
                      // TODO: we need some additional function to get the filter value and also compare the value when filtering
                      return isNil(rowValue) ? EMPTY_FIELD : String(rowValue);
                    })
                )
              )
            );
          }

          // Set filter default values to all values in set
          filter.value = acc[columnKey];

          return acc;
        }, {});

      return {
        ...state,
        columnMap,
        filters,
        filterSetValues,
      };
    }
    case 'UPDATE_FILTER': {
      const { column, filter } = action.payload;
      return {
        ...state,
        filters: {
          ...state.filters,
          [column]: state.filters[column].map((currFilter) => (currFilter.type === filter.type ? filter : currFilter)),
        },
      };
    }
  }
}

export interface DataTableRef<T> {
  hasSortApplied: () => boolean;
  getFilteredAndSortedRows: () => readonly T[];
  hasReorderedColumns: () => boolean;
  /** Takes into account re-ordered columns */
  getCurrentColumns: () => ColumnWithFilter<T>[];
  /** Takes into account re-ordered columns */
  getCurrentColumnNames: () => string[];
}

export interface DataTableProps<T = RowWithKey, TContext = Record<string, any>>
  extends Omit<DataGridProps<T>, 'columns' | 'rows' | 'rowKeyGetter'> {
  data: T[];
  columns: ColumnWithFilter<T>[];
  serverUrl?: string;
  org?: SalesforceOrgUi;
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  context?: TContext;
  allowReorder?: boolean;
  /** Must be stable to avoid constant re-renders */
  contextMenuItems?: ContextMenuItem[];
  /** Must be stable to avoid constant re-renders */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<T>) => void;
  getRowKey: (row: T) => string;
  rowAlwaysVisible?: (row: T) => boolean;
  ignoreRowInSetFilter?: (row: T) => boolean;
  onReorderColumns?: (columns: string[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly T[]) => void;
}

export const DataTable = forwardRef<any, DataTableProps<any>>(
  <T extends object>(
    {
      data,
      columns: _columns,
      serverUrl,
      org,
      quickFilterText,
      includeQuickFilter,
      context,
      allowReorder,
      contextMenuItems,
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
    const [gridId] = useState(() => uniqueId('grid-'));
    const [columns, setColumns] = useState(_columns || []);
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
    const [rowFilterText, setRowFilterText] = useState<Record<string, string>>({});
    const [renderers, setRenderers] = useState<Renderers<T, unknown>>({});

    useEffect(() => {
      if (contextMenuItems && contextMenuAction) {
        setRenderers({
          sortStatus,
          rowRenderer: (key: React.Key, props: RowRendererProps<any>) => {
            return (
              <ContextMenuRenderer
                key={key}
                containerId={gridId}
                props={props}
                contextMenuItems={contextMenuItems}
                contextMenuAction={contextMenuAction}
              />
            );
          },
        });
      } else {
        setRenderers({ sortStatus });
      }
    }, [contextMenuAction, contextMenuItems, gridId]);

    const [{ columnMap, filters, filterSetValues }, dispatch] = useReducer(reducer, {
      columnMap: new Map(),
      filters: {},
      filterSetValues: {},
    });

    useEffect(() => {
      dispatch({ type: 'INIT', payload: { columns: _columns, data, ignoreRowInSetFilter } });
    }, [_columns, data, ignoreRowInSetFilter]);

    useNonInitialEffect(() => {
      setColumns(_columns);
    }, [_columns]);

    useNonInitialEffect(() => {
      onReorderColumns && onReorderColumns(columns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map(({ key }) => key));
    }, [columns, onReorderColumns]);

    useEffect(() => {
      if (Array.isArray(columns) && columns.length && Array.isArray(data) && data.length) {
        setRowFilterText(getSearchTextByRow(data, columns, getRowKey));
      } else {
        setRowFilterText({});
      }
    }, [columns, data, getRowKey]);

    const updateFilter = useCallback((column: string, filter: DataTableFilter) => {
      dispatch({ type: 'UPDATE_FILTER', payload: { column, filter } });
    }, []);

    const sortedRows = useMemo((): readonly T[] => {
      if (sortColumns.length === 0) {
        return data;
      }

      return orderObjectsBy(
        data,
        sortColumns.map(({ columnKey }) => columnKey) as any,
        sortColumns.map(({ direction }) => (direction === 'ASC' ? 'asc' : 'desc'))
      );
    }, [data, sortColumns]);

    const filteredRows = useMemo((): readonly T[] => {
      let quickFilterRegex: RegExp;
      if (includeQuickFilter && quickFilterText) {
        try {
          quickFilterRegex = new RegExp(escapeRegExp(quickFilterText), 'i');
        } catch (ex) {
          logger.warn('Invalid quick filter text', ex);
        }
      }
      return sortedRows.filter((row) => {
        if (rowAlwaysVisible && rowAlwaysVisible(row)) {
          return true;
        }
        const isVisible = Object.keys(filters)
          .filter(
            (columnKey) =>
              Array.isArray(filters[columnKey]) &&
              filters[columnKey].length &&
              filters[columnKey].some((filter) => isFilterActive(filter, sortedRows.length))
          )
          .every((columnKey) => {
            let rowValue = row[columnKey];
            const column = columnMap.get(columnKey);
            if (column?.getValue && column) {
              rowValue = column.getValue({ row, column });
            }
            return filters[columnKey]
              .filter((filter) => isFilterActive(filter, sortedRows.length))
              .every((filter) => {
                const filterResult = filterRecord(filter, rowValue);
                return filterResult;
              });
          });
        // Apply global filter
        const key = getRowKey(row);
        if (quickFilterRegex && key && rowFilterText[key]) {
          return isVisible && quickFilterRegex.test(rowFilterText[key]);
        }
        return isVisible;
      });
    }, [columnMap, filters, getRowKey, includeQuickFilter, quickFilterText, rowAlwaysVisible, rowFilterText, sortedRows]);

    useEffect(() => {
      onSortedAndFilteredRowsChange && onSortedAndFilteredRowsChange(filteredRows);
    }, [filteredRows, onSortedAndFilteredRowsChange]);

    // This will be standard columns unless allowReorder is set to true
    const draggableColumns = useMemo(() => {
      if (!allowReorder) {
        return columns;
      }
      function headerRenderer(props: HeaderRendererProps<T>) {
        return <DraggableHeaderRenderer {...props} onColumnsReorder={handleColumnsReorder} />;
      }

      function handleColumnsReorder(sourceKey: string, targetKey: string) {
        const sourceColumnIndex = columns.findIndex((c) => c.key === sourceKey);
        const targetColumnIndex = columns.findIndex((c) => c.key === targetKey);
        const reorderedColumns = [...columns];

        reorderedColumns.splice(targetColumnIndex, 0, reorderedColumns.splice(sourceColumnIndex, 1)[0]);

        setColumns(reorderedColumns);
      }

      return columns.map((column) => {
        if (column.preventReorder || column.frozen) {
          return column;
        }
        return { ...column, headerRenderer, _priorHeaderRenderer: column.headerRenderer };
      });
    }, [columns, allowReorder]);

    // NOTE: this is not used anywhere, so we may consider removing it.
    useImperativeHandle<unknown, DataTableRef<T>>(
      ref,
      () => {
        return {
          hasSortApplied: () => sortColumns?.length > 0,
          getFilteredAndSortedRows: () => filteredRows,
          hasReorderedColumns: () => {
            if (!allowReorder) {
              return false;
            }
            const columnKeys = draggableColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map(({ key }) => key);
            return (
              allowReorder &&
              draggableColumns
                .filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key))
                .map(({ key }) => key)
                .every((key, i) => columnKeys[i] === key)
            );
          },
          getCurrentColumns: () => draggableColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)),
          getCurrentColumnNames: () => draggableColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map(({ key }) => key),
        };
      },
      [allowReorder, draggableColumns, filteredRows, sortColumns]
    );

    if (serverUrl && org) {
      configIdLinkRenderer(serverUrl, org);
    }

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
              columns={draggableColumns}
              rows={filteredRows}
              renderers={renderers}
              sortColumns={sortColumns}
              onSortColumnsChange={setSortColumns}
              rowKeyGetter={getRowKey}
              defaultColumnOptions={{ resizable: true, sortable: true, ...rest.defaultColumnOptions }}
              {...rest}
            />
          </DataTableFilterContext.Provider>
        </DataTableGenericContext.Provider>
      </ContextMenuContext.Provider>
    );
  }
);
