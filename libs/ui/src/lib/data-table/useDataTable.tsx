import { IconName } from '@jetstream/icon-factory';
import { logger } from '@jetstream/shared/client-logger';
import { hasCtrlOrMeta, isArrowKey, isCKey, isEnterKey, isVKey, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { orderObjectsBy, orderValues } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import copyToClipboard from 'copy-to-clipboard';
import escapeRegExp from 'lodash/escapeRegExp';
import isArray from 'lodash/isArray';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import uniqueId from 'lodash/uniqueId';
import { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useReducer, useState } from 'react';
import {
  CellKeyDownArgs,
  CellKeyboardEvent,
  Row as GridRow,
  RenderRowProps,
  RenderSortStatusProps,
  Renderers,
  SortColumn,
} from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import ContextMenu, { ContextMenuItem } from '../popover/ContextMenu';
import Icon from '../widgets/Icon';
import { configIdLinkRenderer } from './DataTableRenderers';
import { DataTableGenericContext } from './data-table-context';
import './data-table-styles.scss';
import { ColumnWithFilter, ContextMenuActionData, DataTableFilter, DataTableRef, FILTER_SET_TYPES, RowWithKey } from './data-table-types';
import { EMPTY_FIELD, NON_DATA_COLUMN_KEYS, filterRecord, getSearchTextByRow, isFilterActive, resetFilter } from './data-table-utils';

export interface UseDataTableProps {
  data: any[];
  columns: ColumnWithFilter<any>[];
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  org?: SalesforceOrgUi;
  quickFilterText?: string | null;
  includeQuickFilter?: boolean;
  // context?: TContext;
  /** Must be stable to avoid constant re-renders */
  contextMenuItems?: ContextMenuItem[];
  initialSortColumns?: SortColumn[];
  ref: any;
  /** Must be stable to avoid constant re-renders */
  contextMenuAction?: (item: ContextMenuItem, data: ContextMenuActionData<any>) => void;
  getRowKey: (row: any) => string;
  rowAlwaysVisible?: (row: any) => boolean;
  ignoreRowInSetFilter?: (row: any) => boolean;
  onReorderColumns?: (columns: string[], columnOrder: number[]) => void;
  onSortedAndFilteredRowsChange?: (rows: readonly any[]) => void;
}

export function useDataTable<T = RowWithKey>({
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
}: UseDataTableProps) {
  const [gridId] = useState(() => uniqueId('grid-'));
  const [columns, setColumns] = useState(_columns || []);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>(() => initialSortColumns || []);
  const [rowFilterText, setRowFilterText] = useState<Record<string, string>>({});
  const [renderers, setRenderers] = useState<Renderers<T, unknown>>({});
  const [columnsOrder, setColumnsOrder] = useState((): readonly number[] => columns.map((_, index) => index));

  const reorderedColumns = useMemo(() => {
    return columnsOrder.map((index) => columns[index]);
  }, [columns, columnsOrder]);

  useEffect(() => {
    if (contextMenuItems && contextMenuAction) {
      setRenderers({
        renderSortStatus,
        renderRow: (key: React.Key, props: RenderRowProps<any>) => {
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
      setRenderers({ renderSortStatus });
    }
  }, [contextMenuAction, contextMenuItems, gridId]);

  const [{ columnMap, filters, filterSetValues }, dispatch] = useReducer(reducer, {
    hasFilters: false,
    columnMap: new Map(),
    filters: {},
    filterSetValues: {},
  });

  useEffect(() => {
    dispatch({ type: 'INIT', payload: { columns: _columns, data, ignoreRowInSetFilter } });
  }, [_columns, data, ignoreRowInSetFilter]);

  useNonInitialEffect(() => {
    setColumns(_columns);
    setColumnsOrder(_columns.map((_, index) => index));
  }, [_columns]);

  useNonInitialEffect(() => {
    if (onReorderColumns) {
      const newColumns = reorderedColumns.filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)).map(({ key }) => key);
      const remainingIdx = new Set(
        reorderedColumns.map((column, i) => (NON_DATA_COLUMN_KEYS.has(column.key) ? -1 : i)).filter((idx) => idx >= 0)
      );
      const offset = reorderedColumns.length - newColumns.length;
      onReorderColumns(
        newColumns,
        columnsOrder.filter((idx) => remainingIdx.has(idx)).map((index) => index - offset)
      );
    }
  }, [reorderedColumns, columnsOrder, onReorderColumns]);

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

  const sortedRows = useMemo((): readonly RowWithKey[] => {
    if (sortColumns.length === 0) {
      return data;
    }

    return orderObjectsBy(
      data,
      sortColumns.map(({ columnKey }) => columnKey) as any,
      sortColumns.map(({ direction }) => (direction === 'ASC' ? 'asc' : 'desc'))
    );
  }, [data, sortColumns]);

  const filteredRows = useMemo((): readonly RowWithKey[] => {
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

  function handleReorderColumns(sourceKey: string, targetKey: string) {
    setColumnsOrder((columnsOrder) => {
      const sourceColumnOrderIndex = columnsOrder.findIndex((index) => columns[index].key === sourceKey)!;
      const targetColumnOrderIndex = columnsOrder.findIndex((index) => columns[index].key === targetKey)!;
      const sourceColumnOrder = columnsOrder[sourceColumnOrderIndex];
      const newColumnsOrder = columnsOrder.toSpliced(sourceColumnOrderIndex, 1);
      newColumnsOrder.splice(targetColumnOrderIndex, 0, sourceColumnOrder);
      return newColumnsOrder;
    });
  }

  /**
   * For columns that have edit mode, by default any keypress will enable edit mode which breaks things like ctrl+c to copy.
   * Aside from some specific use-cases, we disable the event from being handled by the grid.
   */
  function handleCellKeydown(args: CellKeyDownArgs<T, unknown>, event: CellKeyboardEvent) {
    try {
      /** Events allowed to be handled by the editor */
      if (isArrowKey(event) || isEnterKey(event) || (hasCtrlOrMeta(event) && isVKey(event))) {
        return;
      }

      /** Custom copy to clipboard */
      if (hasCtrlOrMeta(event) && isCKey(event)) {
        const column = args.column as ColumnWithFilter<unknown>;
        let value = args.row[column.key];

        if (isArray(value) || isObject(value)) {
          value = JSON.stringify(value);
        }

        !isNil(value) && copyToClipboard(value);
      }

      event.preventGridDefault();
    } catch (ex) {
      logger.warn('handleCellKeydown Error', ex);
      event.preventGridDefault();
      return;
    }
  }

  // NOTE: this is not used anywhere, so we may consider removing it.
  useImperativeHandle<unknown, DataTableRef<any>>(
    ref,
    () => {
      return {
        hasSortApplied: () => sortColumns?.length > 0,
        getFilteredAndSortedRows: () => filteredRows,
        hasReorderedColumns: () => columnsOrder.some((idx, i) => idx !== i),
        getCurrentColumns: () => columnsOrder.map((idx) => columns[idx]).filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key)),
        getCurrentColumnNames: () =>
          columnsOrder
            .map((idx) => columns[idx])
            .filter((column) => !NON_DATA_COLUMN_KEYS.has(column.key))
            .map(({ key }) => key),
      };
    },
    [columns, columnsOrder, filteredRows, sortColumns?.length]
  );

  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org, skipFrontdoorLogin);
  }
  return {
    gridId,
    columns,
    sortColumns,
    rowFilterText,
    filters,
    renderers,
    columnsOrder,
    reorderedColumns,
    filterSetValues,
    filteredRows,
    setSortColumns,
    updateFilter,
    handleReorderColumns,
    handleCellKeydown,
  };
}

/**
 * SUPPORTING FUNCTIONS
 */

function renderSortStatus({ sortDirection, priority }: RenderSortStatusProps) {
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
  props: RenderRowProps<any>;
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
  hasFilters: boolean;
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
      // If there are filters applied, never reset table state if data changes
      if (state.hasFilters) {
        return state;
      }
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
            acc[columnKey] = orderValues(
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
        hasFilters: true,
        filters: {
          ...state.filters,
          [column]: state.filters[column].map((currFilter) => (currFilter.type === filter.type ? filter : currFilter)),
        },
      };
    }
  }
}
