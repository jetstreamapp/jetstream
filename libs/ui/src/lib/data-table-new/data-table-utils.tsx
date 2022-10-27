import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { ensureBoolean } from '@jetstream/shared/utils';
import { MapOf } from '@jetstream/types';
import isAfter from 'date-fns/isAfter';
import isBefore from 'date-fns/isBefore';
import isSameDay from 'date-fns/isSameDay';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import { Field } from 'jsforce';
import { isBoolean, isNil, isNumber, isString } from 'lodash';
import uniqueId from 'lodash/uniqueId';
import { createContext } from 'react';
import { FormatterProps, HeaderRendererProps, SelectColumn, useRowSelection } from 'react-data-grid';
import { getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import {
  dataTableAddressValueFormatter,
  dataTableDateFormatter,
  dataTableLocationFormatter,
  dataTableTimeFormatter,
} from '../data-table/data-table-utils';
import Checkbox from '../form/checkbox/Checkbox';
import { ColumnWithFilter, DataTableFilter, FilterContextProps, FilterType } from './data-table-types';
import { ActionRenderer, BooleanRenderer, ComplexDataRenderer, FilterRenderer, HeaderFilter, IdLinkRenderer } from './DataTableRenderers';

const SFDC_EMPTY_ID = '000000000000000AAA';

export const EMPTY_FIELD = '-BLANK-';

export const DataTableFilterContext = createContext<FilterContextProps>(undefined);

export function getRowId(data: any): string {
  if (data?._key) {
    return data._key;
  }
  if (data?.attributes?.type === 'AggregateResult') {
    return uniqueId('row-id');
  }
  let nodeId = data?.attributes?.url || data.Id || data.id || data.key;
  if (!nodeId || nodeId.endsWith(SFDC_EMPTY_ID) || data.Id === SFDC_EMPTY_ID) {
    nodeId = uniqueId('row-id');
  }
  return nodeId;
}

function SelectFormatter(props: FormatterProps<any>) {
  const { column, row } = props;
  const [isRowSelected, onRowSelectionChange] = useRowSelection();

  return (
    <Checkbox
      id={`checkbox-${column.name}-${getRowId(row)}`} // TODO: need way to get row id
      label="Select row"
      hideLabel
      checked={isRowSelected}
      onChange={(checked) => onRowSelectionChange({ row, checked, isShiftClick: false })}
      // indeterminate={props.row.getIsSomeSelected()}
      // onChangeNative={props.row.getToggleSelectedHandler()}
    />
  );
}

function SelectHeaderRenderer(props: HeaderRendererProps<any>) {
  const { column, allRowsSelected, onAllRowsSelectionChange } = props;

  return (
    <Checkbox
      id={`checkbox-${column.name}_header`} // TODO: need way to get row id
      label="Select all"
      hideLabel
      checked={allRowsSelected}
      onChange={(checked) => onAllRowsSelectionChange(checked)}
      // indeterminate={props.row.getIsSomeSelected()}
      // onChangeNative={props.row.getToggleSelectedHandler()}
    />
  );
}

export function getColumnDefinitions<T = any>(results: QueryResults<T>, isTooling: boolean): ColumnWithFilter<any>[] {
  // if we have id, include record actions
  // const includeRecordActions =
  //   !isTooling && results.queryResults.records.length
  //     ? !!(results.queryResults.records[0]?.Id || results.queryResults.records[0]?.attributes.url)
  //     : false;
  // const output: SalesforceQueryColumnDefinition = {
  //   parentColumns: [],
  //   subqueryColumns: {},
  // };

  // map each field to the returned metadata from SFDC
  let queryColumnsByPath: MapOf<QueryResultsColumn> = {};
  if (results.columns?.columns) {
    queryColumnsByPath = results.columns.columns.reduce((out, curr, i) => {
      out[curr.columnFullPath.toLowerCase()] = curr;
      // some subqueries (e.x. TYPEOF) is not returned from the salesforce "column.childColumnPaths"
      // in this case, we need to mock the response structure
      // https://github.com/paustint/jetstream/issues/3#issuecomment-728028624
      if (!Array.isArray(curr.childColumnPaths) && results.parsedQuery?.fields?.[i] && isFieldSubquery(results.parsedQuery.fields[i])) {
        curr.childColumnPaths = [];
      }

      if (Array.isArray(curr.childColumnPaths)) {
        curr.childColumnPaths.forEach((subqueryField) => {
          out[subqueryField.columnFullPath.toLowerCase()] = subqueryField;
        });
      }
      return out;
    }, {});
  }

  // Base fields
  const columnDefs: ColumnWithFilter<any>[] = getFlattenedFields(results.parsedQuery).map((field, i) =>
    getColDef(field, queryColumnsByPath, isFieldSubquery(results.parsedQuery?.[i]))
  );

  // set checkbox as first column
  if (columnDefs.length > 0) {
    columnDefs.unshift({
      ...SelectColumn,
      resizable: false,
      formatter: SelectFormatter,
      headerRenderer: SelectHeaderRenderer,
      // headerCellClass: 'select-checkbox',
      // cellClass: 'select-checkbox',
    });
    columnDefs.unshift({
      key: '_actions',
      name: '',
      resizable: false,
      width: 100,
      formatter: ActionRenderer,
      frozen: true,
      sortable: false,
      // headerRenderer: SelectHeaderRenderer,
      // headerCellClass: 'select-checkbox',
      // cellClass: 'select-checkbox',
    });
  }

  // output.parentColumns = flattenedFields;

  // subquery fields - only used if user clicks "view data" on a field so that the table can be built properly
  // results.parsedQuery?.fields
  //   .filter((field) => isFieldSubquery(field))
  //   .forEach((field: FieldSubquery) => {
  //     output.subqueryColumns[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) =>
  //       getColDef(field, queryColumnsByPath, false)
  //     );
  //   });

  return columnDefs;
}

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

function getColDef<T = any>(field: string, queryColumnsByPath: MapOf<QueryResultsColumn>, isSubquery: boolean): ColumnWithFilter<any> {
  const column: Mutable<ColumnWithFilter<any>> = {
    name: field,
    key: field,
    cellClass: 'slds-truncate',
    resizable: true,
    sortable: true,
    width: 200,
    filters: ['TEXT', 'SET'],
    headerRenderer: (props) => (
      <FilterRenderer {...props}>
        {({ filters, filterSetValues, updateFilter }) => (
          <HeaderFilter columnKey={column.key} filters={filters} filterSetValues={filterSetValues} updateFilter={updateFilter} />
        )}
      </FilterRenderer>
    ),

    // headerCellClass
    // summaryCellClass
    // formatter
    // summaryFormatter
    // groupFormatter
  };

  const fieldLowercase = field.toLowerCase();
  if (queryColumnsByPath[fieldLowercase]) {
    const col = queryColumnsByPath[fieldLowercase];
    column.name = col.columnFullPath;
    column.key = col.columnFullPath;
    if (col.booleanType) {
      column.formatter = BooleanRenderer;
      column.filters = ['BOOLEAN_SET'];
      column.width = 100;
      // column.filterParams = {
      //   filters: [{ filter: 'agSetColumnFilter' }],
      // };
    } else if (col.numberType) {
      // column.filterParams = {
      //   filters: [{ filter: 'agNumberColumnFilter' }, { filter: 'agSetColumnFilter' }],
      // };
    } else if (col.apexType === 'Id') {
      column.formatter = IdLinkRenderer;
      column.width = 175;
    } else if (col.apexType === 'Date' || col.apexType === 'Datetime') {
      column.formatter = ({ column, row }) => dataTableDateFormatter({ value: row[column.key] });
      column.filters = ['DATE', 'SET'];
      // column.getQuickFilterText = dataTableDateFormatter;
      // column.filterParams = {
      //   filters: [
      //     {
      //       filter: 'agDateColumnFilter',
      //       filterParams: {
      //         defaultOption: 'greaterThan',
      //         comparator: DateFilterComparator,
      //         buttons: ['clear'],
      //       },
      //     },
      //     {
      //       filter: 'agSetColumnFilter',
      //       filterParams: {
      //         valueFormatter: dataTableDateFormatter,
      //         showTooltips: true,
      //       },
      //     },
      //   ],
      // };
    } else if (col.apexType === 'Time') {
      // column.valueFormatter = dataTableTimeFormatter;
      column.formatter = ({ column, row }) => dataTableTimeFormatter({ value: row[column.key] });
      // column.getQuickFilterText = dataTableTimeFormatter;
      // TODO: add time filter
      // column.filter = 'agDateColumnFilter';
      // column.filterParams.comparator = DateFilterComparator;
    } else if (col.apexType === 'Address') {
      column.formatter = ({ column, row }) => dataTableAddressValueFormatter(row[column.key]);
      // column.valueGetter = dataTableAddressValueGetter(col.columnFullPath);
      // column.filterParams = {
      //   filters: [
      //     {
      //       filter: 'agTextColumnFilter',
      //     },
      //     {
      //       filter: 'agSetColumnFilter',
      //       filterParams: {
      //         valueFormatter: ({ value }: ValueFormatterParams) => (value ? value.replace(REGEX.NEW_LINE, ' ') : value),
      //         showTooltips: true,
      //       },
      //     },
      //   ],
      // };
    } else if (col.apexType === 'Location') {
      // column.valueFormatter = dataTableLocationFormatter;
      column.formatter = ({ column, row }) => dataTableLocationFormatter({ value: row[column.key] });
      // column.getQuickFilterText = dataTableLocationFormatter;
    } else if (col.apexType === 'complexvaluetype' || col.columnName === 'Metadata') {
      column.formatter = ComplexDataRenderer;
      // column.filter = null;
    } else if (Array.isArray(col.childColumnPaths)) {
      // TODO:
      // column.formatter = 'subqueryRenderer';
      // column.valueGetter = (params) => params.data[params.column.field]?.records;
      // column.keyCreator = (params) => (params.value?.length ? `Has Child Records` : 'No Child Records');
      // column.filterParams = {
      //   filters: [
      //     {
      //       filter: 'agSetColumnFilter',
      //       filterParams: {
      //         values: ['Has Child Records', 'No Child Records'],
      //       },
      //     },
      //   ],
      // };
    }
  } else {
    if (field.endsWith('Id')) {
      column.formatter = IdLinkRenderer;
    } else if (isSubquery) {
      // TODO:
      // colDef.cellRenderer = 'subqueryRenderer';
    }
  }
  return column;
}

export function addFieldLabelToColumn<T = any>(columnDefinitions: ColumnWithFilter<any>[], fieldMetadata: MapOf<Field>) {
  if (fieldMetadata) {
    // set field api name and label
    return columnDefinitions.map((col) => {
      if (fieldMetadata[col.key?.toLowerCase()]?.label) {
        const label = fieldMetadata[col.key.toLowerCase()].label;
        return {
          ...col,
          name: `${col.name} (${label})`,
        };
      }
      return col;
    });
  }
  return columnDefinitions;
}

export function resetFilter(type: FilterType): DataTableFilter {
  switch (type) {
    case 'TEXT':
      return { type, value: '' };
    case 'NUMBER':
      return { type, value: null, comparator: 'EQUALS' };
    case 'DATE':
      return { type, value: '', comparator: 'GREATER_THAN' };
    case 'SET':
    case 'BOOLEAN_SET':
      return { type, value: [] };
    default:
      throw new Error(`Filter type ${type} not supported`);
  }
}

export function isFilterActive(filter: DataTableFilter): boolean {
  switch (filter?.type) {
    case 'TEXT':
      return !!filter.value;
    case 'NUMBER':
      return isNumber(filter.value) || !!filter.value;
    case 'DATE':
      return !!filter.value; // TODO: is valid date
    case 'SET':
    case 'BOOLEAN_SET':
      return !!filter.value?.length;
    default:
      return false;
  }
}

export function filterRecord(filter: DataTableFilter, value: any): boolean {
  switch (filter?.type) {
    case 'TEXT': {
      if (!isString(value)) {
        return false;
      }
      return value.toLowerCase().includes(filter.value.toLowerCase());
    }
    case 'NUMBER': {
      const filterValue = Number(filter.value);
      if (!isNumber(value)) {
        return false;
      }
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return value > filterValue;
        case 'LESS_THAN':
          return value < filterValue;
        case 'EQUALS':
        default:
          return value === filterValue;
      }
    }
    case 'DATE': {
      if (!value) {
        return false;
      }
      const dateFilter = startOfDay(parseISO(filter.value));
      const date = startOfDay(parseISO(value));
      switch (filter.comparator) {
        case 'GREATER_THAN':
          return isAfter(date, dateFilter);
        case 'LESS_THAN':
          return isBefore(date, dateFilter);
        case 'EQUALS':
        default:
          return isSameDay(date, dateFilter);
      }
    }
    case 'BOOLEAN_SET': {
      if (!filter.value.length) {
        return false;
      } else if (filter.value.length === 2) {
        return true;
      }
      const filterValue = ensureBoolean(filter.value[0]);
      return value === ensureBoolean(filterValue);
    }
    case 'SET': {
      const includeNulls = filter.value.includes(EMPTY_FIELD);
      return (isNil(value) && includeNulls) || (!isNil(value) && filter.value.includes(String(value)));
    }
    default:
      return false;
  }
}
