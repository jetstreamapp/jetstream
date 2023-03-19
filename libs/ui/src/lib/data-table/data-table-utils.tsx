import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { transformTabularDataToExcelStr, transformTabularDataToHtml } from '@jetstream/shared/ui-utils';
import { ensureBoolean, flattenRecords, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MapOf } from '@jetstream/types';
import copyToClipboard from 'copy-to-clipboard';
import isAfter from 'date-fns/isAfter';
import isBefore from 'date-fns/isBefore';
import isSameDay from 'date-fns/isSameDay';
import isDateValid from 'date-fns/isValid';
import parseDate from 'date-fns/parse';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import startOfMinute from 'date-fns/startOfMinute';
import type { Field } from 'jsforce';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import { SelectColumn, SELECT_COLUMN_KEY as _SELECT_COLUMN_KEY } from 'react-data-grid';
import { FieldSubquery, getField, getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import { ContextMenuItem } from '../popover/ContextMenu';
import {
  dataTableAddressValueFormatter,
  dataTableDateFormatter,
  dataTableLocationFormatter,
  dataTableTimeFormatter,
} from './data-table-formatters';
import {
  ColumnType,
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  DataTableFilter,
  FilterType,
  RowWithKey,
  SalesforceQueryColumnDefinition,
} from './data-table-types';
import {
  ActionRenderer,
  BooleanRenderer,
  ComplexDataRenderer,
  FilterRenderer,
  GenericRenderer,
  HeaderFilter,
  IdLinkRenderer,
  SelectFormatter,
  SelectHeaderRenderer,
} from './DataTableRenderers';
import { SubqueryRenderer } from './DataTableSubqueryRenderer';

const SFDC_EMPTY_ID = '000000000000000AAA';

export const EMPTY_FIELD = '-BLANK-';
export const ACTION_COLUMN_KEY = '_actions';
export const SELECT_COLUMN_KEY = _SELECT_COLUMN_KEY;
export const NON_DATA_COLUMN_KEYS = new Set([SELECT_COLUMN_KEY, ACTION_COLUMN_KEY]);

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

/**
 * Get columns for a generic table. Use this when the data is provided by the user and types of columns are generally unknown
 *
 * @param headers
 * @param defaultFilters If no type is provided, the default filters that will be applied
 * @returns
 */
export function getColumnsForGenericTable(
  headers: { label: string; key: string; columnProps?: Partial<ColumnWithFilter<RowWithKey>>; type?: ColumnType }[],
  defaultFilters: FilterType[] = ['TEXT', 'SET']
): ColumnWithFilter<RowWithKey>[] {
  return headers.map(({ label, key, columnProps, type }) => {
    const column: Mutable<ColumnWithFilter<RowWithKey>> = {
      name: label,
      key,
      resizable: true,
      sortable: true,
      filters: defaultFilters,
      formatter: GenericRenderer,
      headerRenderer: (props) => (
        <FilterRenderer {...props}>
          {({ filters, filterSetValues, portalRefForFilters, updateFilter }) => (
            <HeaderFilter
              columnKey={column.key}
              filters={filters}
              filterSetValues={filterSetValues}
              portalRefForFilters={portalRefForFilters}
              updateFilter={updateFilter}
            />
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
  // If there is a FIELDS('') clause in the query, then we know the data will not be shown
  // in this case, fall back to Salesforce column data instead of the query results
  const hasFieldsQuery = results.parsedQuery?.fields?.some(
    (field) => field.type === 'FieldFunctionExpression' && field.functionName === 'FIELDS'
  );
  if (results.parsedQuery && hasFieldsQuery) {
    results.parsedQuery.fields = results.columns?.columns?.map((column) => getField(column.columnFullPath));
  }

  // Base fields
  const parentColumns: ColumnWithFilter<RowWithKey>[] = getFlattenedFields(results.parsedQuery || {}).map((field, i) =>
    getQueryResultColumn(field, queryColumnsByPath, isFieldSubquery(results.parsedQuery?.[i]))
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
    ?.filter((field) => isFieldSubquery(field))
    .forEach((field: FieldSubquery) => {
      output.subqueryColumns[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) =>
        getQueryResultColumn(field, queryColumnsByPath, false)
      );
    });

  return output;
}

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

function getQueryResultColumn(
  field: string,
  queryColumnsByPath: MapOf<QueryResultsColumn>,
  isSubquery: boolean
): ColumnWithFilter<RowWithKey> {
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
        {({ filters, filterSetValues, portalRefForFilters, updateFilter }) => (
          <HeaderFilter
            columnKey={column.key}
            filters={filters}
            filterSetValues={filterSetValues}
            portalRefForFilters={portalRefForFilters}
            updateFilter={updateFilter}
          />
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
 * Based on field type, update formatter and filters
 *
 * @param fieldType
 * @param defaultProps
 * @returns
 */
export function setColumnFromType<T>(key: string, fieldType: ColumnType, defaultProps?: Partial<Mutable<ColumnWithFilter<T>>>) {
  const column: Partial<Mutable<ColumnWithFilter<T>>> = { ...defaultProps };
  column.headerRenderer = (props) => (
    <FilterRenderer {...props}>
      {({ filters, filterSetValues, portalRefForFilters, updateFilter }) => (
        <HeaderFilter
          columnKey={key}
          filters={filters}
          filterSetValues={filterSetValues}
          portalRefForFilters={portalRefForFilters}
          updateFilter={updateFilter}
        />
      )}
    </FilterRenderer>
  );
  updateColumnFromType(column as Mutable<ColumnWithFilter<T>>, fieldType);
  return column;
}

/**
 * Based on field type, update formatters and filters
 * @param column
 * @param fieldType
 */
export function updateColumnFromType(column: Mutable<ColumnWithFilter<any>>, fieldType: ColumnType) {
  column.filters = ['TEXT', 'SET'];
  switch (fieldType) {
    case 'text':
      break;
    case 'number':
      // TODO:
      break;
    case 'subquery':
      column.filters = ['SET'];
      column.formatter = SubqueryRenderer;
      column.getValue = ({ column, row }) => {
        const results = row[column.key];
        if (!results || !results.totalSize) {
          return null;
        }
        return `${results.records.length} ${pluralizeFromNumber('record', results.records.length)}`;
      };
      break;
    case 'object':
      column.filters = [];
      column.formatter = ComplexDataRenderer;
      break;
    case 'location':
      column.formatter = ({ column, row }) => dataTableLocationFormatter(row[column.key]);
      column.getValue = ({ column, row }) => dataTableLocationFormatter(row[column.key]);
      break;
    case 'date':
      column.filters = ['DATE', 'SET'];
      column.formatter = ({ column, row }) => dataTableDateFormatter(row[column.key]);
      column.getValue = ({ column, row }) => dataTableDateFormatter(row[column.key]);
      break;
    case 'time':
      column.filters = ['TIME', 'SET'];
      column.formatter = ({ column, row }) => dataTableTimeFormatter(row[column.key]);
      column.getValue = ({ column, row }) => dataTableTimeFormatter(row[column.key]);
      break;
    case 'boolean':
      column.filters = ['BOOLEAN_SET'];
      column.formatter = BooleanRenderer;
      column.width = 100;
      break;
    case 'address':
      column.formatter = ({ column, row }) => dataTableAddressValueFormatter(row[column.key]);
      column.getValue = ({ column, row }) => dataTableAddressValueFormatter(row[column.key]);
      break;
    case 'salesforceId':
      column.formatter = IdLinkRenderer;
      column.width = 175;
      break;
    default:
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

export function resetFilter(type: FilterType, setValues: string[] = []): DataTableFilter {
  switch (type) {
    case 'TEXT':
      return { type, value: '' };
    case 'NUMBER':
      return { type, value: null, comparator: 'EQUALS' };
    case 'DATE':
      return { type, value: '', comparator: 'GREATER_THAN' };
    case 'TIME':
      return { type, value: '', comparator: 'GREATER_THAN' };
    case 'SET':
    case 'BOOLEAN_SET':
      return { type, value: setValues };
    default:
      throw new Error(`Filter type ${type} not supported`);
  }
}

export function isFilterActive(filter: DataTableFilter, totalValues: number): boolean {
  switch (filter?.type) {
    case 'TEXT':
      return !!filter.value;
    case 'NUMBER':
      return isNumber(filter.value) || !!filter.value;
    case 'DATE':
      return !!filter.value; // TODO: is valid date
    case 'TIME':
      return !!filter.value;
    case 'SET':
      return (filter.value?.length || 0) < totalValues;
    case 'BOOLEAN_SET':
      return (filter.value?.length || 0) !== 2;
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
      if (!value || !filter.value) {
        return false;
      }
      const dateFilter = startOfDay(parseISO(filter.value));
      let date: Date;
      if (value.length === 21) {
        date = parseDate(value, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a, new Date());
      } else {
        date = startOfDay(parseISO(value));
      }
      if (!isDateValid(date)) {
        return false;
      }
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
    case 'TIME': {
      if (!value) {
        return false;
      }
      const dateFilter = startOfMinute(parseDate(filter.value, DATE_FORMATS.HH_MM_SS_SSSS, new Date()));
      const date = startOfMinute(parseDate(value, DATE_FORMATS.HH_MM_SS_a, new Date()));
      if (!isDateValid(dateFilter) || !isDateValid(date)) {
        return false;
      }
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
      return (includeNulls && isNil(value)) || (!isNil(value) && filter.value.includes(String(value)));
    }
    default:
      return false;
  }
}

export function getSubqueryModalTagline(parentRecord: any) {
  let currModalTagline: string | undefined = undefined;
  let recordName: string | undefined = undefined;
  let recordId: string | undefined = undefined;
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
 * Some URLS from salesforce do not allow accessing from id, but have varying URL structures
 * Also, some url paths are not allowed as redirect urls and are flagged to be skipped
 *
 * @param id
 * @param record
 * @returns
 */
export function getSfdcRetUrl(id: string, record: any): { skipFrontDoorAuth: boolean; url: string } {
  const type = record?.attributes?.type;
  switch (type) {
    case 'Group':
      return {
        skipFrontDoorAuth: true,
        url: `/lightning/setup/PublicGroups/page?address=${encodeURIComponent(`/setup/own/groupdetail.jsp?id=${id}`)}`,
      };
    default:
      return { skipFrontDoorAuth: false, url: `/${id}` };
  }
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
            let value = row[column.key];
            if (column.getValue) {
              value = column.getValue({ row, column });
            }
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

export const TABLE_CONTEXT_MENU_ITEMS: ContextMenuItem<ContextAction>[] = [
  { label: 'Copy cell to clipboard', value: 'COPY_CELL', divider: true },

  { label: 'Copy row to clipboard (Excel)', value: 'COPY_ROW_EXCEL' },
  { label: 'Copy row to clipboard (JSON)', value: 'COPY_ROW_JSON', divider: true },

  { label: 'Copy column to clipboard (Excel)', value: 'COPY_COL' },
  { label: 'Copy column to clipboard (JSON)', value: 'COPY_COL_JSON' },
  { label: 'Copy column to clipboard without header', value: 'COPY_COL_NO_HEADER', divider: true },

  { label: 'Copy table to clipboard (Excel)', value: 'COPY_TABLE' },
  { label: 'Copy table to clipboard (JSON)', value: 'COPY_TABLE_JSON' },
];

/**
 * FOR USE IN SALESFORCE RECORDS ONLY (assumes _record property)
 * Generic function to copy table data to clipboard
 * Assumes ContextMenuItem[]
 * Other use-cases will need to implement their own
 */
export function copySalesforceRecordTableDataToClipboard(
  action: ContextAction,
  fields: string[],
  { row, rows, column, columns }: ContextMenuActionData<RowWithKey>
) {
  let includeHeader = true;
  let recordsToCopy: unknown[] = [];
  const records = rows.map((row) => row._record);
  const fieldsSet = new Set(fields);
  let fieldsToCopy = columns.map((column) => column.key).filter((field) => fieldsSet.has(field)); // prefer this over fields because it accounts for reordering
  let format: 'plain' | 'excel' | 'json' = 'plain';

  switch (action) {
    case 'COPY_CELL':
      includeHeader = false;
      fieldsToCopy = [column.key];
      recordsToCopy = [row._record];
      break;

    case 'COPY_ROW_EXCEL':
      format = 'excel';
      recordsToCopy = [row._record];
      break;

    case 'COPY_ROW_JSON':
      recordsToCopy = [row._record];
      format = 'json';
      break;

    case 'COPY_COL':
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = records.map((row) => ({ [column.key]: row[column.key] }));
      format = 'excel';
      break;

    case 'COPY_COL_JSON':
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = records.map((row) => ({ [column.key]: row[column.key] }));
      format = 'json';
      break;

    case 'COPY_COL_NO_HEADER':
      includeHeader = false;
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = records.map((row) => ({ [column.key]: row[column.key] }));
      format = 'plain';
      break;

    case 'COPY_TABLE':
      recordsToCopy = records;
      break;

    case 'COPY_TABLE_JSON':
      recordsToCopy = records;
      format = 'json';
      break;

    default:
      break;
  }
  if (recordsToCopy.length) {
    if (format === 'json') {
      copyToClipboard(JSON.stringify(recordsToCopy, null, 2), { format: 'text/plain' });
    } else if (format === 'excel') {
      const flattenedData = flattenRecords(recordsToCopy, fieldsToCopy);
      copyToClipboard(transformTabularDataToHtml(flattenedData, fieldsToCopy), { format: 'text/html' });
    } else {
      const flattenedData = flattenRecords(recordsToCopy, fieldsToCopy);
      copyToClipboard(transformTabularDataToExcelStr(flattenedData, fieldsToCopy, includeHeader), { format: 'text/plain' });
    }
  }
}
