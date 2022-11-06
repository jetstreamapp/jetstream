import { IconName } from '@jetstream/icon-factory';
import { logger } from '@jetstream/shared/client-logger';
import { orderObjectsBy, orderStringsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import escapeRegExp from 'lodash/escapeRegExp';
import isNil from 'lodash/isNil';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, { Column, DataGridProps, SortColumn, SortStatusProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import Icon from '../widgets/Icon';
import './data-table-styles.scss';
import { ColumnWithFilter, DataTableFilter, FILTER_SET_TYPES, RowWithKey } from './data-table-types';
import {
  DataTableFilterContext,
  DataTableGenericContext,
  EMPTY_FIELD,
  filterRecord,
  getSearchTextByRow,
  isFilterActive,
  resetFilter,
} from './data-table-utils';
import { configIdLinkRenderer } from './DataTableRenderers';

function sortStatus({ sortDirection, priority }: SortStatusProps) {
  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';
  return sortDirection !== undefined ? (
    <>
      <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-icon_xx-small" />
      <span>{priority}</span>
    </>
  ) : null;
}

export interface DataTableNewProps<T = RowWithKey, TContext = Record<string, any>>
  extends Omit<DataGridProps<T>, 'columns' | 'rows' | 'rowKeyGetter'> {
  data: T[];
  columns: ColumnWithFilter<T>[];
  serverUrl?: string;
  org?: SalesforceOrgUi;
  quickFilterText?: string;
  includeQuickFilter?: boolean;
  getRowKey: (row: T) => string;
  context?: TContext;
}

const DataTable = <T extends object>({
  data,
  columns,
  serverUrl,
  org,
  quickFilterText,
  includeQuickFilter,
  getRowKey,
  context,
  ...rest
}: DataTableNewProps<T>) => {
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  // TODO: will be used for filtering
  const [columnMap, setColumnMap] = useState<Map<string, ColumnWithFilter<T>>>(() => new Map());
  const [filters, setFilters] = useState<Record<string, DataTableFilter[]>>({});
  // TODO: do we need label and value?
  const [filterSetValues, setFilterSetValues] = useState<Record<string, string[]>>({});
  const [rowFilterText, setRowFilterText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (Array.isArray(columns) && columns.length && Array.isArray(data) && data.length) {
      setRowFilterText(getSearchTextByRow(data, columns, getRowKey));
    } else {
      setRowFilterText({});
    }
  }, [columns, data, getRowKey]);

  useEffect(() => {
    setColumnMap(new Map(columns.map((column) => [column.key, column])));
    setFilters(
      columns.reduce((acc: Record<string, DataTableFilter[]>, column) => {
        if (Array.isArray(column.filters)) {
          acc[column.key] = column.filters.map((filter) => resetFilter(filter));
        }
        return acc;
      }, {})
    );
  }, [columns]);

  useEffect(() => {
    setFilterSetValues(
      Object.keys(filters)
        .filter((columnKey) => Array.isArray(filters[columnKey]) && filters[columnKey].some(({ type }) => FILTER_SET_TYPES.has(type)))
        .reduce((acc: Record<string, string[]>, columnKey) => {
          const filter = filters[columnKey].find(({ type }) => FILTER_SET_TYPES.has(type));
          const column = columnMap.get(columnKey);
          const getValueFn = columnMap.get(columnKey)?.getValue || (({ row, column }) => row[columnKey]);
          if (filter.type === 'BOOLEAN_SET') {
            acc[columnKey] = ['True', 'False'];
          } else {
            acc[columnKey] = orderStringsBy(
              Array.from(
                new Set(
                  data.map((row) => {
                    const rowValue = getValueFn({ row, column });
                    // TODO: we need some additional function to get the filter value and also compare the value when filtering
                    return isNil(row[columnKey]) ? EMPTY_FIELD : String(rowValue);
                  })
                )
              )
            );
          }

          return acc;
        }, {})
    );
  }, [columnMap, data, filters]);

  const updateFilter = useCallback((column: string, filter: DataTableFilter) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [column]: prevFilters[column].map((currFilter) => (currFilter.type === filter.type ? filter : currFilter)),
    }));
  }, []);

  const sortedRows = useMemo((): readonly T[] => {
    if (sortColumns.length === 0) {
      return data;
    }
    // TODO: what about complex data?
    // TODO: what about getValue on filter
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
      const isVisible = Object.keys(filters)
        .filter(
          (columnKey) =>
            Array.isArray(filters[columnKey]) && filters[columnKey].length && filters[columnKey].some((filter) => isFilterActive(filter))
        )
        .every((columnKey) => {
          let rowValue = row[columnKey];
          const column = columnMap.get(columnKey);
          if (column?.getValue) {
            rowValue = column.getValue({ row, column: columnMap.get(columnKey) });
          }
          return filters[columnKey].filter(isFilterActive).every((filter) => filterRecord(filter, rowValue));
        });
      // Apply global filter
      const key = getRowKey(row);
      if (quickFilterRegex && key && rowFilterText[key]) {
        return isVisible && quickFilterRegex.test(rowFilterText[key]);
      }
      return isVisible;
    });
  }, [filters, getRowKey, includeQuickFilter, quickFilterText, rowFilterText, sortedRows]);

  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
    <DataTableGenericContext.Provider value={context}>
      <DataTableFilterContext.Provider
        value={{
          filterSetValues,
          filters,
          updateFilter,
        }}
      >
        <DataGrid
          className="rdg-light fill-grid"
          columns={columns}
          rows={filteredRows}
          renderers={{ sortStatus }}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          rowKeyGetter={getRowKey}
          defaultColumnOptions={{ resizable: true, sortable: true, ...rest.defaultColumnOptions }}
          {...rest}
        />
      </DataTableFilterContext.Provider>
    </DataTableGenericContext.Provider>
  );
};

export const DataTableNew = memo(DataTable);

export default DataTableNew;
