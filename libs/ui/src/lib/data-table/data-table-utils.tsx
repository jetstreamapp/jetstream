/** @jsx jsx */
import { CellEvent, CellKeyDownEvent, ColDef, ColumnEvent, GetQuickFilterTextParams, ValueFormatterParams } from '@ag-grid-community/core';
import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { isEnterKey } from '@jetstream/shared/ui-utils';
import { queryResultColumnToTypeLabel } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import copy from 'copy-to-clipboard';
import formatDate from 'date-fns/format';
import parseDate from 'date-fns/parse';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import isObject from 'lodash/isObject';
import { createContext } from 'react';
import { FieldSubquery, getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import './data-table-styles.scss';

export interface SalesforceAddressField {
  city?: string;
  country?: string;
  CountryCode?: string;
  latitude?: number;
  longitude?: number;
  postalCode?: string;
  state?: string;
  StateCode?: string;
  street?: string;
}

export interface SalesforceLocationField {
  latitude: number;
  longitude: number;
}

export interface SalesforceQueryColumnDefinition {
  parentColumns: ColDef[];
  subqueryColumns: MapOf<ColDef[]>;
}

export interface DataTableContextValue {
  serverUrl: string;
  org: SalesforceOrgUi;
  columnDefinitions: SalesforceQueryColumnDefinition;
}

export interface TableContext {
  actions: {
    edit: (row: any) => void;
    clone: (row: any) => void;
  };
}

const newLineRegex = /\\n/g;

/**
 * This is used to allow child cell renderers to have access to context specific data
 * e.x. subquery renderer
 */
export const DataTableContext = createContext<DataTableContextValue>({
  serverUrl: null,
  org: null,
  columnDefinitions: { parentColumns: [], subqueryColumns: {} },
});

export function getCheckboxColumnDef(includeActions?: boolean): ColDef {
  return {
    cellRenderer: includeActions ? 'actionRenderer' : undefined,
    checkboxSelection: true,
    headerCheckboxSelection: true,
    headerCheckboxSelectionFilteredOnly: true,
    width: includeActions ? 110 : 50,
    filter: false,
    sortable: false,
    resizable: false,
    pinned: true,
  };
}

export function DateFilterComparator(filterDate: Date, cellValue: string): number {
  if (!cellValue) {
    return 0;
  }
  const cellDate = startOfDay(parseISO(cellValue));
  if (cellDate < filterDate) {
    return -1;
  } else if (cellDate > filterDate) {
    return 1;
  } else {
    return 0;
  }
}

export const dataTableAddressFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  if (!isObject(value)) {
    return '';
  }
  const address: SalesforceAddressField = value;
  const street = (address.street || '').replace(newLineRegex, '');
  const remainingParts = [address.city, address.state, address.postalCode, address.country].filter((part) => !!part).join(', ');
  return [street, remainingParts].join('\n');
};

export const dataTableLocationFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  if (!isObject(value)) {
    return '';
  }
  const location: SalesforceLocationField = value as SalesforceLocationField;
  return `Latitude: ${location.latitude}°, Longitude: ${location.longitude}°`;
};

export const dataTableDateFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  const dateOrDateTime: string = value;
  if (!dateOrDateTime) {
    return '';
  } else if (dateOrDateTime.length === 28) {
    return formatDate(parseISO(dateOrDateTime), DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a);
  } else if (dateOrDateTime.length === 10) {
    return formatDate(startOfDay(parseISO(dateOrDateTime)), DATE_FORMATS.yyyy_MM_dd);
  } else {
    return dateOrDateTime;
  }
};

export const dataTableTimeFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  const time: string = value;
  if (!time) {
    return '';
  } else if (time.length === 13) {
    return formatDate(parseDate(time, DATE_FORMATS.HH_mm_ss_ssss_z, new Date()), DATE_FORMATS.HH_MM_SS_a);
  } else {
    return time;
  }
};

export function getCurrentColumnOrder(event: ColumnEvent): string[] {
  return event.columnApi
    .getAllDisplayedColumns()
    .map((col) => col.getColDef())
    .filter((col) => col.field)
    .map((col) => col.field);
}

export function getFilteredRows<T = any>(event: ColumnEvent): T[] {
  const visibleRecords: T[] = [];
  event.api.forEachNodeAfterFilter((rowNode, index) => {
    visibleRecords.push(rowNode.data);
  });
  return visibleRecords;
}

export function getColumnDefinitions(results: QueryResults<any>): SalesforceQueryColumnDefinition {
  // if we have id, include record actions
  const includeRecordActions = results.queryResults.records.length
    ? !!(results.queryResults.records[0]?.Id || results.queryResults.records[0]?.attributes.url)
    : false;
  const output: SalesforceQueryColumnDefinition = {
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
  const flattenedFields: ColDef[] = getFlattenedFields(results.parsedQuery).map((field, i) =>
    getColDef(field, queryColumnsByPath, isFieldSubquery(results.parsedQuery[i]))
  );

  // set checkbox as first column
  if (flattenedFields.length > 0) {
    flattenedFields.unshift(getCheckboxColumnDef(includeRecordActions));
  }

  output.parentColumns = flattenedFields;

  // subquery fields - only used if user clicks "view data" on a field so that the table can be built properly
  results.parsedQuery.fields
    .filter((field) => isFieldSubquery(field))
    .forEach((field: FieldSubquery) => {
      output.subqueryColumns[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) =>
        getColDef(field, queryColumnsByPath, false)
      );
    });

  return output;
}

/**
 * Convert query with results to table column definitions
 * @param field string - full path of field
 * @param queryColumnsByPath map of field with full path (lowercased) to the column definition
 * @param isSubquery one used as a fallback - use the parsed subquery to indicate if this is a subquery
 */
function getColDef(field: string, queryColumnsByPath: MapOf<QueryResultsColumn>, isSubquery: boolean): ColDef {
  const colDef: ColDef = {
    headerName: field,
    field: field,
    headerTooltip: field,
    filterParams: {
      buttons: ['reset'],
    },
  };
  const fieldLowercase = field.toLowerCase();

  // If we have column data from SFDC, then use it
  if (queryColumnsByPath[fieldLowercase]) {
    const col = queryColumnsByPath[fieldLowercase];
    colDef.headerName = col.columnFullPath;
    colDef.field = col.columnFullPath;
    colDef.headerTooltip = `${col.columnFullPath} (${queryResultColumnToTypeLabel(col)})`;
    if (col.booleanType) {
      colDef.cellRenderer = 'booleanRenderer';
      colDef.filter = 'booleanFilterRenderer';
    } else if (col.numberType) {
      colDef.filter = 'agNumberColumnFilter';
    } else if (col.apexType === 'Id') {
      colDef.cellRenderer = 'idLinkRenderer';
    } else if (col.apexType === 'Date' || col.apexType === 'Datetime') {
      colDef.valueFormatter = dataTableDateFormatter;
      colDef.getQuickFilterText = dataTableDateFormatter;
      colDef.filter = 'agDateColumnFilter';
      colDef.filterParams.comparator = DateFilterComparator;
    } else if (col.apexType === 'Time') {
      colDef.valueFormatter = dataTableTimeFormatter;
      colDef.getQuickFilterText = dataTableTimeFormatter;
      // TODO: add time filter
      // colDef.filter = 'agDateColumnFilter';
      // colDef.filterParams.comparator = DateFilterComparator;
    } else if (col.apexType === 'Address') {
      colDef.valueFormatter = dataTableAddressFormatter;
      colDef.getQuickFilterText = dataTableAddressFormatter;
    } else if (col.apexType === 'Location') {
      colDef.valueFormatter = dataTableLocationFormatter;
      colDef.getQuickFilterText = dataTableLocationFormatter;
    } else if (Array.isArray(col.childColumnPaths)) {
      colDef.cellRenderer = 'subqueryRenderer';
    }
  } else {
    // we do not have any metadata from SFDC, so we will try to detect basic scenarios
    if (field.endsWith('Id')) {
      colDef.cellRenderer = 'idLinkRenderer';
    } else if (isSubquery) {
      colDef.cellRenderer = 'subqueryRenderer';
    }
  }

  return colDef;
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

export function handleCellKeydown(props: CellKeyDownEvent) {
  const { event } = props;
  if (event && isEnterKey(event as any)) {
    handleCellDoubleClicked(props);
  }
}

export function handleCellDoubleClicked(props: CellEvent) {
  const { api, column, colDef, value, node } = props;
  if (typeof value === 'undefined' || value === null) {
    return;
  }
  let copiedValue = value;
  if (Array.isArray(value)) {
    copiedValue = JSON.stringify(value);
  } else if (typeof colDef.valueFormatter === 'function') {
    copiedValue = colDef.valueFormatter(props);
  }
  if (typeof copiedValue === 'object') {
    copiedValue = JSON.stringify(value);
  }
  const didCopy = copy(copiedValue);
  if (didCopy) {
    api.flashCells({
      rowNodes: [node],
      columns: [column],
      flashDelay: 0,
      fadeDelay: 100,
    });
  }
}
