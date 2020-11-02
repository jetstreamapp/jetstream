/** @jsx jsx */
import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { queryResultColumnToTypeLabel } from '@jetstream/shared/utils';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import formatDate from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import isObject from 'lodash/isObject';
import { getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import { MapOf } from '@jetstream/types';
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

const newLineRegex = /\\n/g;

export function getCheckboxColumnDef(): ColDef {
  return {
    checkboxSelection: true,
    headerCheckboxSelection: true,
    headerCheckboxSelectionFilteredOnly: true,
    width: 50,
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

export const dataTableAddressFormatter = ({ value }: ValueFormatterParams): string => {
  if (!isObject(value)) {
    return '';
  }
  const address: SalesforceAddressField = value;
  const street = (address.street || '').replace(newLineRegex, '');
  const remainingParts = [address.city, address.state, address.postalCode, address.country].filter((part) => !!part).join(', ');
  return [street, remainingParts].join('\n');
};

export const dataTableLocationFormatter = ({ value }: ValueFormatterParams): string => {
  if (!isObject(value)) {
    return '';
  }
  const location: SalesforceLocationField = value as SalesforceLocationField;
  return `Latitude: ${location.latitude}°, Longitude: ${location.longitude}°`;
};

export const dataTableDateFormatter = ({ value }: ValueFormatterParams): string => {
  const dateOrDateTime: string = value;
  if (!dateOrDateTime) {
    return '';
  } else if (dateOrDateTime.length === 28) {
    return formatDate(parseISO(dateOrDateTime), 'yyyy-MM-dd h:mm:ss a');
  } else if (dateOrDateTime.length === 10) {
    return formatDate(startOfDay(parseISO(dateOrDateTime)), 'yyyy-MM-dd');
  } else {
    return dateOrDateTime;
  }
};

export function getColumnDefinitions(results: QueryResults<any>): ColDef[] {
  let queryColumnsByPath: MapOf<QueryResultsColumn> = {};
  if (results.columns?.columns) {
    queryColumnsByPath = results.columns.columns.reduce((out, curr) => {
      out[curr.columnFullPath.toLowerCase()] = curr;
      if (Array.isArray(curr.childColumnPaths)) {
        curr.childColumnPaths.forEach((subqueryField) => {
          out[subqueryField.columnFullPath.toLowerCase()] = subqueryField;
        });
      }
      return out;
    }, {});
  }

  // Base fields
  const flattenedFields: ColDef[] = getFlattenedFields(results.parsedQuery).map((field, i) => {
    // if we do not get field definition from SFDC, then we cannot have a rich render
    const colDef: ColDef = {
      headerName: field,
      field: field,
      headerTooltip: field,
      filterParams: {
        buttons: ['reset'],
      },
    };
    const fieldLowercase = field.toLowerCase();
    // if we have type information, then use it to display field contents properly
    if (queryColumnsByPath[fieldLowercase]) {
      const col = queryColumnsByPath[fieldLowercase];

      colDef.headerName = col.displayName;
      colDef.field = col.columnFullPath;
      colDef.headerTooltip = `${col.displayName} (${queryResultColumnToTypeLabel(col)})`;
      if (col.booleanType) {
        colDef.cellRenderer = 'booleanRenderer';
        colDef.filter = 'booleanFilterRenderer';
      } else if (col.numberType) {
        colDef.filter = 'agNumberColumnFilter';
      } else if (col.apexType === 'Id') {
        colDef.cellRenderer = 'idLinkRenderer';
      } else if (col.apexType === 'Date' || col.apexType === 'Datetime') {
        colDef.valueFormatter = dataTableDateFormatter;
        colDef.filter = 'agDateColumnFilter';
        colDef.filterParams.comparator = DateFilterComparator;
      } else if (col.apexType === 'Address') {
        colDef.valueFormatter = dataTableAddressFormatter;
      } else if (col.apexType === 'Location') {
        colDef.valueFormatter = dataTableLocationFormatter;
      } else if (Array.isArray(col.childColumnPaths)) {
        colDef.cellRenderer = 'subqueryRenderer';
      }
    } else {
      // we do not have any metadata from SFDC, so we will try to detect basic scenarios
      if (field.endsWith('Id')) {
        colDef.cellRenderer = 'idLinkRenderer';
      } else if (isFieldSubquery(results.parsedQuery[i])) {
        colDef.cellRenderer = 'subqueryRenderer';
      }
    }
    return colDef;
  });

  // set checkbox as first column
  if (flattenedFields.length > 0) {
    flattenedFields.unshift(getCheckboxColumnDef());
  }

  return flattenedFields;

  // TODO: this will need to be called for subquery renders - might want to move this there and have that component have state
  // // subquery fields - only used if user clicks "view data" on a field so that the table can be built properly
  // const tempSubqueryFieldMap: MapOf<string[]> = {};
  // results.parsedQuery.fields
  //   .filter((field) => isFieldSubquery(field))
  //   .forEach((field: FieldSubquery) => {
  //     tempSubqueryFieldMap[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) => {
  //       const fieldLowercase = field.toLowerCase();
  //       return queryColumnsByPath[fieldLowercase] ? queryColumnsByPath[fieldLowercase].columnFullPath : field;
  //     });
  //   });
}
