import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import DataGrid, { Column, FormatterProps, HeaderRendererProps, SelectColumn, useRowSelection } from 'react-data-grid';
import { getFlattenedFields, isFieldSubquery } from 'soql-parser-js';
import { MapOf } from '@jetstream/types';
import { Fragment, FunctionComponent, memo } from 'react';
import Icon from '../widgets/Icon';
import Checkbox from '../form/checkbox/Checkbox';
import uniqueId from 'lodash/uniqueId';
import { isFunction } from 'lodash';
import { ActionRenderer, BooleanRenderer, ComplexDataRenderer, IdLinkRenderer } from './DataTableRenderers';
import {
  dataTableAddressValueFormatter,
  dataTableAddressValueGetter,
  dataTableDateFormatter,
  dataTableLocationFormatter,
  dataTableTimeFormatter,
} from '../data-table/data-table-utils';

const SFDC_EMPTY_ID = '000000000000000AAA';

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

export function getColumnDefinitions<T = any>(results: QueryResults<T>, isTooling: boolean): Column<T>[] {
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
  const columnDefs: Column<T>[] = getFlattenedFields(results.parsedQuery).map((field, i) =>
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

// export const Actionformatter = memo((props: CellContext<any, unknown>) => {
//   return (
//     <div className="slds-grid">
//       <Checkbox
//         id={`checkbox-${props.row.id}`}
//         label="Select row"
//         hideLabel
//         checked={props.row.getIsSelected()}
//         // indeterminate={props.row.getIsSomeSelected()}
//         onChangeNative={props.row.getToggleSelectedHandler()}
//       />
//       <ActionRenderer {...props} />
//     </div>
//   );
// });

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

function getColDef<T = any>(field: string, queryColumnsByPath: MapOf<QueryResultsColumn>, isSubquery: boolean): Column<T> {
  const column: Mutable<Column<T>> = {
    name: field,
    key: field,
    cellClass: 'slds-truncate',
    resizable: true,
    sortable: true,
    width: 200,
    // headerRenderer
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
