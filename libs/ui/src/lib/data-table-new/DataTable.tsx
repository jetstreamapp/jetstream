import { createContext, FunctionComponent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, { Column, DataGridProps, SortColumn, SortStatusProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import './data-table-styles.scss';
import Icon from '../widgets/Icon';
import { IconName } from '@jetstream/icon-factory';
import { orderObjectsBy, orderStringsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { configIdLinkRenderer } from './DataTableRenderers';
import { ColumnWithFilter, DataTableFilter, FilterContextProps, FILTER_SET_TYPES } from './data-table-types';
import { DataTableFilterContext, EMPTY_FIELD, filterRecord, isFilterActive, resetFilter } from './data-table-utils';
import { isNil } from 'lodash';

function sortStatus({ sortDirection, priority }: SortStatusProps) {
  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';
  return sortDirection !== undefined ? (
    <>
      <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-icon_xx-small" />
      <span>{priority}</span>
    </>
  ) : null;
}

export interface DataTableNewProps extends Omit<DataGridProps<any>, 'columns' | 'rows'> {
  data: any[];
  columns: ColumnWithFilter<any>[];
  serverUrl?: string;
  org?: SalesforceOrgUi;
}

const DataTable: FunctionComponent<DataTableNewProps> = ({ data, columns, serverUrl, org, ...rest }) => {
  const tableContainerRef = useRef<HTMLTableSectionElement>(null);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  // TODO: will be used for filtering
  const [columnMap, setColumnMap] = useState<Map<string, Column<any>>>(() => new Map());
  const [filters, setFilters] = useState<Record<string, DataTableFilter[]>>({});
  // TODO: do we need label and value?
  const [filterSetValues, setFilterSetValues] = useState<Record<string, string[]>>({});

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
          if (filter.type === 'BOOLEAN_SET') {
            acc[columnKey] = ['True', 'False'];
          } else {
            acc[columnKey] = orderStringsBy(
              Array.from(
                new Set(
                  data.map((row) => {
                    const rowValue = row[columnKey];
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

  const sortedRows = useMemo((): readonly any[] => {
    if (sortColumns.length === 0) {
      return data;
    }
    // TODO: what about complex data?
    return orderObjectsBy(
      data,
      sortColumns.map(({ columnKey }) => columnKey) as any,
      sortColumns.map(({ direction }) => (direction === 'ASC' ? 'asc' : 'desc'))
    );
  }, [data, sortColumns]);

  const filteredRows = useMemo((): readonly any[] => {
    return sortedRows.filter((row) => {
      return Object.keys(filters)
        .filter(
          (columnKey) =>
            Array.isArray(filters[columnKey]) && filters[columnKey].length && filters[columnKey].some((filter) => isFilterActive(filter))
        )
        .every((columnKey) => {
          const rowValue = row[columnKey];
          return filters[columnKey].filter(isFilterActive).every((filter) => filterRecord(filter, rowValue));
        });
    });
  }, [filters, sortedRows]);

  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
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
        {...rest}
      />
    </DataTableFilterContext.Provider>
  );
};

export const DataTableNew = memo(DataTable);

export default DataTableNew;
