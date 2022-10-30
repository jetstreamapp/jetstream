import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { ensureBoolean } from '@jetstream/shared/utils';
import { MapOf } from '@jetstream/types';
import isAfter from 'date-fns/isAfter';
import isBefore from 'date-fns/isBefore';
import isSameDay from 'date-fns/isSameDay';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import { Field } from 'jsforce';
import { isNil, isNumber, isObject, isString } from 'lodash';
import uniqueId from 'lodash/uniqueId';
import { createContext } from 'react';
import {
  FormatterProps,
  HeaderRendererProps,
  SelectColumn,
  SELECT_COLUMN_KEY as _SELECT_COLUMN_KEY,
  useRowSelection,
} from 'react-data-grid';
import { FieldSubquery, getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import {
  dataTableAddressValueFormatter,
  dataTableDateFormatter,
  dataTableLocationFormatter,
  dataTableTimeFormatter,
} from '../data-table/data-table-utils';
import Checkbox from '../form/checkbox/Checkbox';
import {
  ColumnWithFilter,
  DataTableFilter,
  FilterContextProps,
  FilterType,
  SubqueryContext,
  SalesforceQueryColumnDefinition,
  RowWithKey,
  ColumnType,
} from './data-table-types';
import {
  ActionRenderer,
  BooleanRenderer,
  ComplexDataRenderer,
  FilterRenderer,
  HeaderFilter,
  IdLinkRenderer,
  SubqueryRenderer,
} from './DataTableRenderers';

const SFDC_EMPTY_ID = '000000000000000AAA';

export const EMPTY_FIELD = '-BLANK-';
export const ACTION_COLUMN_KEY = '_actions';
export const SELECT_COLUMN_KEY = _SELECT_COLUMN_KEY;
export const NON_DATA_COLUMN_KEYS = new Set([SELECT_COLUMN_KEY, ACTION_COLUMN_KEY]);

// Used to ensure that renderers and filters can have access to global state
export const DataTableFilterContext = createContext<FilterContextProps>(undefined);
export const DataTableSubqueryContext = createContext<SubqueryContext>(undefined);

export function getRowId(data: any): string {
  if (data?._key) {
    return data._key;
  }
  if (data?.key) {
    return data.key;
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

function SelectFormatter<T>(props: FormatterProps<T>) {
  const { column, row } = props;
  const [isRowSelected, onRowSelectionChange] = useRowSelection();

  return (
    <Checkbox
      id={`checkbox-${column.name}-${getRowId(row)}`} // TODO: need way to get row id
      label="Select row"
      hideLabel
      checked={isRowSelected}
      onChange={(checked) => onRowSelectionChange({ row, checked, isShiftClick: false })}
    />
  );
}

function SelectHeaderRenderer<T>(props: HeaderRendererProps<T>) {
  const { column, allRowsSelected, onAllRowsSelectionChange } = props;

  return (
    <Checkbox
      id={`checkbox-${column.name}_header`} // TODO: need way to get row id
      label="Select all"
      hideLabel
      checked={allRowsSelected}
      onChange={(checked) => onAllRowsSelectionChange(checked)}
      // WAITING ON: https://github.com/adazzle/react-data-grid/issues/3058
      // indeterminate={props.row.getIsSomeSelected()}
    />
  );
}

export function getColumnsForGenericTable(
  headers: { label: string; key: string; columnProps?: Partial<ColumnWithFilter<RowWithKey>>; type?: ColumnType }[]
): ColumnWithFilter<RowWithKey>[] {
  return headers.map(({ label, key, columnProps, type }) => {
    const column: Mutable<ColumnWithFilter<RowWithKey>> = {
      name: label,
      key,
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
    };
    if (type) {
      updateColumnFromType(column, type);
    }
    return { ...column, ...columnProps } as ColumnWithFilter<RowWithKey>;
  });
}

/**
 * Produce table columns from a Salesforce query
 * @param results
 * @param isTooling
 * @returns
 */
export function getColumnDefinitions(results: QueryResults<any>, isTooling: boolean): SalesforceQueryColumnDefinition<any> {
  // if we have id, include record actions
  const includeRecordActions =
    !isTooling && results.queryResults.records.length
      ? !!(results.queryResults.records[0]?.Id || results.queryResults.records[0]?.attributes.url)
      : false;
  const output: SalesforceQueryColumnDefinition<any> = {
    parentColumns: [],
    subqueryColumns: {},
  };

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
  const parentColumns: ColumnWithFilter<RowWithKey>[] = getFlattenedFields(results.parsedQuery).map((field, i) =>
    getColDef(field, queryColumnsByPath, isFieldSubquery(results.parsedQuery?.[i]))
  );

  // set checkbox as first column
  if (parentColumns.length > 0) {
    parentColumns.unshift({
      ...SelectColumn,
      key: SELECT_COLUMN_KEY,
      resizable: false,
      formatter: SelectFormatter,
      headerRenderer: SelectHeaderRenderer,
    });
    if (includeRecordActions) {
      parentColumns.unshift({
        key: ACTION_COLUMN_KEY,
        name: '',
        resizable: false,
        width: 100,
        formatter: ActionRenderer,
        frozen: true,
        sortable: false,
      });
    }
  }

  output.parentColumns = parentColumns;

  // subquery fields - only used if user clicks "view data" on a field so that the table can be built properly
  results.parsedQuery?.fields
    .filter((field) => isFieldSubquery(field))
    .forEach((field: FieldSubquery) => {
      output.subqueryColumns[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) =>
        getColDef(field, queryColumnsByPath, false)
      );
    });

  return output;
}

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

function getColDef(field: string, queryColumnsByPath: MapOf<QueryResultsColumn>, isSubquery: boolean): ColumnWithFilter<RowWithKey> {
  const column: Mutable<ColumnWithFilter<RowWithKey>> = {
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
  };

  const fieldLowercase = field.toLowerCase();
  if (queryColumnsByPath[fieldLowercase]) {
    const col = queryColumnsByPath[fieldLowercase];
    column.name = col.columnFullPath;
    column.key = col.columnFullPath;
    updateColumnFromType(column, getColumnTypeFromQueryResultsColumn(col));
    // if (col.booleanType) {
    //   column.formatter = BooleanRenderer;
    //   column.filters = ['BOOLEAN_SET'];
    //   column.width = 100;
    // } else if (col.numberType) {
    //   // TODO: gt, eq, lt
    //   // column.filterParams = {
    //   //   filters: [{ filter: 'agNumberColumnFilter' }, { filter: 'agSetColumnFilter' }],
    //   // };
    // } else if (col.apexType === 'Id') {
    //   column.formatter = IdLinkRenderer;
    //   column.width = 175;
    // } else if (col.apexType === 'Date' || col.apexType === 'Datetime') {
    //   column.formatter = ({ column, row }) => dataTableDateFormatter({ value: row[column.key] });
    //   column.filters = ['DATE', 'SET'];
    // } else if (col.apexType === 'Time') {
    //   // column.valueFormatter = dataTableTimeFormatter;
    //   column.formatter = ({ column, row }) => dataTableTimeFormatter({ value: row[column.key] });
    //   // column.getQuickFilterText = dataTableTimeFormatter;
    //   // TODO: add time filter
    //   // column.filter = 'agDateColumnFilter';
    //   // column.filterParams.comparator = DateFilterComparator;
    // } else if (col.apexType === 'Address') {
    //   column.formatter = ({ column, row }) => dataTableAddressValueFormatter(row[column.key]);
    //   // column.valueGetter = dataTableAddressValueGetter(col.columnFullPath);
    //   // column.filterParams = {
    //   //   filters: [
    //   //     {
    //   //       filter: 'agTextColumnFilter',
    //   //     },
    //   //     {
    //   //       filter: 'agSetColumnFilter',
    //   //       filterParams: {
    //   //         valueFormatter: ({ value }: ValueFormatterParams) => (value ? value.replace(REGEX.NEW_LINE, ' ') : value),
    //   //         showTooltips: true,
    //   //       },
    //   //     },
    //   //   ],
    //   // };
    // } else if (col.apexType === 'Location') {
    //   // column.valueFormatter = dataTableLocationFormatter;
    //   column.formatter = ({ column, row }) => dataTableLocationFormatter({ value: row[column.key] });
    //   // column.getQuickFilterText = dataTableLocationFormatter;
    // } else if (col.apexType === 'complexvaluetype' || col.columnName === 'Metadata') {
    //   column.formatter = ComplexDataRenderer;
    //   // column.filter = null;
    // } else if (Array.isArray(col.childColumnPaths)) {
    //   // TODO:
    //   column.formatter = SubqueryRenderer;
    //   column.filters = [];
    //   // TODO: set filter should be "with records, without records" - kinda like boolean
    //   // column.valueGetter = (params) => params.data[params.column.field]?.records;
    //   // column.keyCreator = (params) => (params.value?.length ? `Has Child Records` : 'No Child Records');
    //   // column.filterParams = {
    //   //   filters: [
    //   //     {
    //   //       filter: 'agSetColumnFilter',
    //   //       filterParams: {
    //   //         values: ['Has Child Records', 'No Child Records'],
    //   //       },
    //   //     },
    //   //   ],
    //   // };
    // }
  } else {
    if (field.endsWith('Id')) {
      updateColumnFromType(column, 'salesforceId');
    } else if (isSubquery) {
      updateColumnFromType(column, 'subquery');
    }
  }
  return column;
}

function getColumnTypeFromQueryResultsColumn(col: QueryResultsColumn): ColumnType {
  if (col.booleanType) {
    return 'boolean';
  } else if (col.numberType) {
    return 'number';
  } else if (col.apexType === 'Id') {
    return 'salesforceId';
  } else if (col.apexType === 'Date' || col.apexType === 'Datetime') {
    return 'date';
  } else if (col.apexType === 'Time') {
    return 'time';
  } else if (col.apexType === 'Address') {
    return 'address';
  } else if (col.apexType === 'Location') {
    return 'location';
  } else if (col.apexType === 'complexvaluetype' || col.columnName === 'Metadata') {
    return 'object';
  } else if (Array.isArray(col.childColumnPaths)) {
    return 'subquery';
  }
  return 'text';
}

/**
 * Based on field type, update formatters and filters
 * @param column
 * @param fieldType
 */
function updateColumnFromType(column: Mutable<ColumnWithFilter<RowWithKey>>, fieldType: ColumnType) {
  switch (fieldType) {
    case 'text':
      break;
    case 'number':
      // TODO:
      break;
    case 'subquery':
      column.formatter = SubqueryRenderer;
      column.filters = []; // TODO:
      break;
    case 'object':
      column.formatter = ComplexDataRenderer;
      break;
    case 'location':
      column.formatter = ({ column, row }) => dataTableLocationFormatter({ value: row[column.key] });
      break;
    case 'date':
      column.formatter = ({ column, row }) => dataTableDateFormatter({ value: row[column.key] });
      column.filters = ['DATE', 'SET'];
      break;
    case 'time':
      column.formatter = ({ column, row }) => dataTableTimeFormatter({ value: row[column.key] });
      // TODO: add time filter
      break;
    case 'boolean':
      column.formatter = BooleanRenderer;
      column.filters = ['BOOLEAN_SET'];
      column.width = 100;
      break;
    case 'address':
      column.formatter = ({ column, row }) => dataTableAddressValueFormatter(row[column.key]);
      // TODO: filters
      break;
    case 'salesforceId':
      column.formatter = IdLinkRenderer;
      column.width = 175;
      break;
  }
}

export function addFieldLabelToColumn(columnDefinitions: ColumnWithFilter<RowWithKey>[], fieldMetadata: MapOf<Field>) {
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

export function getSubqueryModalTagline(parentRecord: any) {
  let currModalTagline: string;
  let recordName: string;
  let recordId: string;
  try {
    if (parentRecord.Name) {
      recordName = parentRecord.Name;
    }
    if (parentRecord?.Id) {
      recordId = parentRecord.Id;
    } else if (parentRecord?.attributes?.url) {
      recordId = parentRecord.attributes.url.substring(parentRecord.attributes.url.lastIndexOf('/') + 1);
    }
  } catch (ex) {
    // ignore error
  } finally {
    // if we have name and id, then show both, otherwise only show one or the other
    if (recordName || recordId) {
      currModalTagline = 'Parent Record: ';
      if (recordName) {
        currModalTagline += recordName;
      }
      if (recordName && recordId) {
        currModalTagline += ` (${recordId})`;
      } else if (recordId) {
        currModalTagline += recordId;
      }
    }
  }
  return currModalTagline;
}

/**
 * Get text to allow for global search filtering
 */
export function getSearchTextByRow<T>(rows: T[], columns: ColumnWithFilter<T>[], getRowKey: (row: T) => string): Record<string, string> {
  const output: Record<string, string> = {};
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const key = getRowKey(row);
      if (key) {
        columns.forEach((column) => {
          if (column.key) {
            const value = row[column.key];
            if (!isNil(value) && !isObject(value)) {
              let filterValue = String(value);
              if (filterValue === '[object Object]') {
                filterValue = JSON.stringify(value);
              }
              output[key] = `${output[key] || ''}${filterValue.toLowerCase()}`;
            }
          }
        });
      }
    });
  }
  return output;
}
