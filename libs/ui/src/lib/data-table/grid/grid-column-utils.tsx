/* eslint-disable @typescript-eslint/no-explicit-any */
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Field, Maybe, QueryResults, QueryResultsColumn } from '@jetstream/types';
import { FieldSubquery, getField, getFlattenedFields, isFieldSubquery } from '@jetstreamapp/soql-parser-js';
import {
  dataTableAddressValueFormatter,
  dataTableDateFormatter,
  dataTableLocationFormatter,
  dataTableTimeFormatter,
} from '../data-table-formatters';
import { EditorBoolean, EditorDate, EditorText, editorDropdown, editorRecordLookup } from './editors/CellEditors';
import { ACTION_COLUMN_KEY, SELECT_COLUMN_KEY } from './grid-constants';
import { ColumnType, ColumnWithFilter, FilterType, RowWithKey, SalesforceQueryColumnDefinition } from './grid-types';
import {
  ActionRenderer,
  BooleanRenderer,
  ComplexDataRenderer,
  GenericRenderer,
  IdLinkRenderer,
  NameLinkRenderer,
  SelectColumn,
  TextOrIdLinkRenderer,
} from './renderers/CellRenderers';
import { SubqueryRenderer } from './renderers/SubqueryRenderer';

type Mutable<Type> = { -readonly [Key in keyof Type]: Type[Key] };

/**
 * Get columns for a generic table when the data is user-provided and column types are unknown.
 */
export function getColumnsForGenericTable(
  headers: { label: string; key: string; columnProps?: Partial<ColumnWithFilter<RowWithKey>>; type?: ColumnType }[],
  defaultFilters: FilterType[] = ['TEXT', 'SET'],
): ColumnWithFilter<RowWithKey>[] {
  return headers.map(({ label, key, columnProps, type }) => {
    const column: Mutable<ColumnWithFilter<RowWithKey>> = {
      name: label,
      key,
      resizable: true,
      sortable: true,
      filters: defaultFilters,
      renderCell: TextOrIdLinkRenderer,
    };
    if (type) {
      updateColumnFromType(column, type);
    }
    return { ...column, ...columnProps } as ColumnWithFilter<RowWithKey>;
  });
}

/**
 * Produce table columns from a Salesforce query (+ field metadata).
 */
export function getColumnDefinitions(
  results: QueryResults<any>,
  isTooling: boolean,
  fieldMetadata?: Maybe<Record<string, Field>>,
  fieldMetadataSubquery?: Maybe<Record<string, Record<string, Field>>>,
): SalesforceQueryColumnDefinition<any> {
  const includeRecordActions =
    !isTooling && results.queryResults.records.length
      ? !!(results.queryResults.records[0]?.Id || results.queryResults.records[0]?.attributes.url)
      : false;
  const output: SalesforceQueryColumnDefinition<any> = { parentColumns: [], subqueryColumns: {} };

  const subqueryRelationshipNames = new Set(
    results.parsedQuery?.fields?.filter(isFieldSubquery).map((f) => f.subquery.relationshipName.toLowerCase()) || [],
  );

  let queryColumnsByPath: Record<string, QueryResultsColumn> = {};
  if (results.columns?.columns) {
    queryColumnsByPath = results.columns.columns.reduce(
      (out, curr) => {
        out[curr.columnFullPath.toLowerCase()] = curr;
        if (!Array.isArray(curr.childColumnPaths) && subqueryRelationshipNames.has(curr.columnFullPath.toLowerCase())) {
          curr.childColumnPaths = [];
        }
        if (Array.isArray(curr.childColumnPaths)) {
          curr.childColumnPaths.forEach((subqueryField) => {
            out[subqueryField.columnFullPath.toLowerCase()] = {
              ...subqueryField,
              columnFullPath: subqueryField.columnFullPath.split('.').slice(1).join('.'),
            } as QueryResultsColumn;
          });
        }
        return out;
      },
      {} as Record<string, QueryResultsColumn>,
    );
  }

  const hasFieldsQuery = results.parsedQuery?.fields?.some(
    (field) => field.type === 'FieldFunctionExpression' && field.functionName === 'FIELDS',
  );
  if (results.parsedQuery && hasFieldsQuery) {
    results.parsedQuery.fields = results.columns?.columns?.map((column) => getField(column.columnFullPath));
  }

  const parentColumns: ColumnWithFilter<RowWithKey>[] = getFlattenedFields(results.parsedQuery || {}).map((field) =>
    getQueryResultColumn({ field, queryColumnsByPath, isSubquery: subqueryRelationshipNames.has(field.toLowerCase()), fieldMetadata }),
  );

  if (parentColumns.length > 0) {
    parentColumns.unshift({ ...SelectColumn, key: SELECT_COLUMN_KEY, resizable: false });
    if (includeRecordActions) {
      parentColumns.unshift({
        key: ACTION_COLUMN_KEY,
        name: '',
        resizable: true,
        width: 116,
        minWidth: 100,
        maxWidth: 150,
        renderCell: ActionRenderer,
        frozen: true,
        sortable: false,
      });
    }
  }
  output.parentColumns = parentColumns;

  results.parsedQuery?.fields
    ?.filter((field) => isFieldSubquery(field))
    .forEach((parentField: FieldSubquery) => {
      output.subqueryColumns[parentField.subquery.relationshipName.toLowerCase()] = getFlattenedFields(parentField.subquery || {}).map(
        (field) =>
          getQueryResultColumn({
            field,
            subqueryRelationshipName: parentField.subquery.relationshipName,
            queryColumnsByPath,
            isSubquery: false,
            allowEdit: false,
            fieldMetadata: fieldMetadataSubquery?.[parentField.subquery.relationshipName.toLowerCase()],
          }),
      );
    });

  return output;
}

function getQueryResultColumn({
  field,
  subqueryRelationshipName,
  queryColumnsByPath,
  isSubquery,
  fieldMetadata,
  allowEdit = true,
}: {
  field: string;
  subqueryRelationshipName?: string;
  queryColumnsByPath: Record<string, QueryResultsColumn>;
  isSubquery: boolean;
  fieldMetadata?: Maybe<Record<string, Field>>;
  allowEdit?: boolean;
}): ColumnWithFilter<RowWithKey> {
  const column: Mutable<ColumnWithFilter<RowWithKey>> = {
    name: field,
    key: field,
    cellClass: (row: any) => {
      const classes = ['slds-truncate'];
      if (row._touchedColumns instanceof Set && (row._touchedColumns as Set<string>).has(field) && row[field] !== row._record?.[field]) {
        classes.push('slds-is-edited');
        if (row._saveError) {
          classes.push('active-item-error');
        }
      }
      return classes.join(' ');
    },
    resizable: true,
    sortable: true,
    draggable: true,
    width: 200,
    filters: ['TEXT', 'SET'],
  };

  let fieldLowercase = field.toLowerCase();
  if (subqueryRelationshipName) {
    fieldLowercase = `${subqueryRelationshipName.toLowerCase()}.${fieldLowercase}`;
  }
  const queryResultColumn = queryColumnsByPath[fieldLowercase];
  let resolvedType: ColumnType = 'text';
  if (queryResultColumn) {
    column.name = queryResultColumn.columnFullPath;
    column.key = queryResultColumn.columnFullPath;
    resolvedType = getColumnTypeFromQueryResultsColumn(queryResultColumn);
    updateColumnFromType(column, resolvedType);
    if (allowEdit && !queryResultColumn.columnFullPath?.includes('.')) {
      updateColumnWithEditMode(column, queryResultColumn, fieldMetadata);
    }
  } else if (field.endsWith('Id')) {
    resolvedType = 'salesforceId';
    updateColumnFromType(column, 'salesforceId');
  } else if (isSubquery) {
    resolvedType = 'subquery';
    updateColumnFromType(column, 'subquery');
  }

  const canonicalColumnPath = queryResultColumn?.columnFullPath ?? column.key;
  const isNameField =
    !!fieldMetadata?.[field.toLowerCase()]?.nameField || canonicalColumnPath === 'Name' || canonicalColumnPath.endsWith('.Name');
  if (!subqueryRelationshipName && !queryResultColumn?.aggregate && resolvedType === 'text' && isNameField) {
    updateColumnFromType(column, 'salesforceName');
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

export function setColumnFromType<T>(key: string, fieldType: ColumnType, defaultProps?: Partial<Mutable<ColumnWithFilter<T>>>) {
  const column: Partial<Mutable<ColumnWithFilter<T>>> = { ...defaultProps, key };
  updateColumnFromType(column as Mutable<ColumnWithFilter<T>>, fieldType);
  return column;
}

export function updateColumnFromType(column: Mutable<ColumnWithFilter<any>>, fieldType: ColumnType) {
  column.filters = ['TEXT', 'SET'];
  switch (fieldType) {
    case 'text':
      column.renderCell = GenericRenderer;
      break;
    case 'number':
      break;
    case 'subquery':
      column.filters = ['SET'];
      column.renderCell = SubqueryRenderer;
      column.getValue = ({ column, row }) => {
        const results = (row as any)[column.key];
        if (!results || !results.totalSize) {
          return null;
        }
        return `${results.records.length} ${pluralizeFromNumber('record', results.records.length)}`;
      };
      break;
    case 'object':
      column.filters = [];
      column.renderCell = ComplexDataRenderer;
      break;
    case 'location':
      column.renderCell = ({ column, row }) => dataTableLocationFormatter((row as any)[column.key]);
      column.getValue = ({ column, row }) => dataTableLocationFormatter((row as any)[column.key]);
      break;
    case 'date':
      column.filters = ['DATE', 'SET'];
      column.renderCell = ({ column, row }) => dataTableDateFormatter((row as any)[column.key]);
      column.getValue = ({ column, row }) => dataTableDateFormatter((row as any)[column.key]);
      break;
    case 'time':
      column.filters = ['TIME', 'SET'];
      column.renderCell = ({ column, row }) => dataTableTimeFormatter((row as any)[column.key]);
      column.getValue = ({ column, row }) => dataTableTimeFormatter((row as any)[column.key]);
      break;
    case 'boolean':
      column.filters = ['BOOLEAN_SET'];
      column.renderCell = BooleanRenderer;
      column.width = 100;
      break;
    case 'address':
      column.renderCell = ({ column, row }) => dataTableAddressValueFormatter((row as any)[column.key]);
      column.getValue = ({ column, row }) => dataTableAddressValueFormatter((row as any)[column.key]);
      break;
    case 'salesforceId':
      column.renderCell = IdLinkRenderer;
      column.width = 175;
      break;
    case 'salesforceName':
      column.renderCell = NameLinkRenderer;
      break;
    case 'textOrSalesforceId':
      column.renderCell = TextOrIdLinkRenderer;
      column.width = 175;
      break;
    default:
      break;
  }
}

export function updateColumnWithEditMode(
  column: Mutable<ColumnWithFilter<any>>,
  { updatable, booleanType, apexType, columnName }: QueryResultsColumn,
  fieldMetadata: Maybe<Record<string, Field>> = {},
) {
  column.editable = false;
  fieldMetadata = fieldMetadata || {};
  const field = fieldMetadata[column.key.toLowerCase()];
  const type = field?.type;
  if (
    (field && !field?.updateable) ||
    !updatable ||
    type === 'complexvalue' ||
    type === 'address' ||
    type === 'anyType' ||
    apexType === 'complexvaluetype' ||
    columnName === 'Metadata'
  ) {
    return;
  } else if (type === 'boolean' || booleanType) {
    column.editable = true;
    column.editorOptions = { commitOnOutsideClick: false, displayCellContent: true };
    column.renderEditCell = EditorBoolean;
  } else if (type === 'date' || apexType === 'Date' || type === 'datetime' || apexType === 'Datetime') {
    column.editable = true;
    column.editorOptions = { commitOnOutsideClick: false, displayCellContent: true };
    column.renderEditCell = EditorDate;
  } else if (field?.picklistValues && (type === 'picklist' || type === 'multipicklist')) {
    column.editable = true;
    column.editorOptions = { commitOnOutsideClick: false, displayCellContent: true };
    column.renderEditCell = editorDropdown({
      isMultiSelect: type === 'multipicklist',
      values: field.picklistValues
        .filter(({ active }) => active)
        .map(({ value, label }) => ({
          id: value,
          label: value,
          secondaryLabel: label !== value ? label : undefined,
          secondaryLabelOnNewLine: label !== value,
          value,
        })),
    });
  } else if (type === 'reference' && field.referenceTo?.length && field.referenceTo?.length > 0) {
    column.editable = true;
    column.editorOptions = { commitOnOutsideClick: false, displayCellContent: true };
    column.renderEditCell = editorRecordLookup({ sobjects: field.referenceTo });
  } else {
    column.editable = true;
    column.editorOptions = { commitOnOutsideClick: false, displayCellContent: true };
    column.renderEditCell = EditorText;
  }
}

/**
 * Compute a new column-order key array by moving `sourceId` to sit before/after `targetId`. Operates on
 * the full order (including non-data keys like select/action) so the caller can hand it straight to
 * `table.setColumnOrder`. Returns the input unchanged when the move is a no-op or either id is missing.
 */
export function reorderColumnOrder(order: string[], sourceId: string, targetId: string, side: 'left' | 'right'): string[] {
  if (sourceId === targetId) {
    return order;
  }
  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return order;
  }

  const next = order.slice();
  next.splice(sourceIndex, 1);
  // Recompute the target index against the post-removal array, then offset for a right-side drop.
  const targetIndexAfterRemoval = next.indexOf(targetId);
  const insertIndex = side === 'right' ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
  next.splice(insertIndex, 0, sourceId);

  // No-op guard: if the resulting order matches the original, return the original reference.
  if (next.every((key, index) => key === order[index])) {
    return order;
  }
  return next;
}

export function addFieldLabelToColumn(columnDefinitions: ColumnWithFilter<RowWithKey>[], fieldMetadata: Record<string, Field>) {
  if (fieldMetadata) {
    return columnDefinitions.map((col) => {
      if (fieldMetadata[col.key?.toLowerCase()]?.label) {
        const label = fieldMetadata[col.key.toLowerCase()].label;
        return { ...col, name: `${col.name} (${label})` };
      }
      return col;
    });
  }
  return columnDefinitions;
}
