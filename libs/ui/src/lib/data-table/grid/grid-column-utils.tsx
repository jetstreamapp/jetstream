/* eslint-disable @typescript-eslint/no-explicit-any */
import { pluralizeFromNumber, walkSubqueries } from '@jetstream/shared/utils';
import { Field, Maybe, QueryResults, QueryResultsColumn } from '@jetstream/types';
import { getField, getFlattenedFields, isFieldSubquery } from '@jetstreamapp/soql-parser-js';
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
  ActionRendererMemo,
  BooleanRenderer,
  ComplexDataRenderer,
  GenericRenderer,
  IdLinkRenderer,
  NameLinkRenderer,
  SelectColumn,
  TextOrIdLinkRenderer,
  withCellValidation,
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

  // Every subquery in the query, at any depth, keyed by lowercased relationship path
  const subqueryRelationshipPaths = new Set<string>();
  for (const { relationshipPath } of walkSubqueries(results.parsedQuery?.fields)) {
    subqueryRelationshipPaths.add(relationshipPath.toLowerCase());
  }
  const subqueryRelationshipNames = new Set(
    results.parsedQuery?.fields?.filter(isFieldSubquery).map((f) => f.subquery.relationshipName.toLowerCase()) || [],
  );

  const queryColumnsByPath: Record<string, QueryResultsColumn> = {};
  registerQueryColumns(results.columns?.columns, '', subqueryRelationshipPaths, queryColumnsByPath);

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
        name: 'Actions',
        resizable: true,
        width: 116,
        minWidth: 100,
        maxWidth: 150,
        renderCell: (props) => <ActionRendererMemo {...props} />,
        frozen: true,
        sortable: false,
      });
    }
  }
  output.parentColumns = parentColumns;

  // Keyed by lowercased relationship path so a nested subquery resolves independently of a same-named one elsewhere
  for (const { subquery, relationshipPath } of walkSubqueries(results.parsedQuery?.fields)) {
    const nestedRelationshipNames = new Set(
      (subquery.fields || []).filter(isFieldSubquery).map(({ subquery }) => subquery.relationshipName.toLowerCase()),
    );
    const subqueryColumns = getFlattenedFields(subquery).map((field) =>
      getQueryResultColumn({
        field,
        subqueryRelationshipPath: relationshipPath,
        queryColumnsByPath,
        isSubquery: nestedRelationshipNames.has(field.toLowerCase()),
        allowEdit: false,
        fieldMetadata: fieldMetadataSubquery?.[relationshipPath.toLowerCase()],
      }),
    );
    // The subquery modal enables row selection, and a checkbox cell only renders for a column keyed
    // SELECT_COLUMN_KEY — without this the selection UI has nowhere to draw.
    if (subqueryColumns.length > 0) {
      subqueryColumns.unshift({ ...SelectColumn, key: SELECT_COLUMN_KEY, resizable: false });
    }
    output.subqueryColumns[relationshipPath.toLowerCase()] = subqueryColumns;
  }

  return output;
}

/**
 * Index the columns Salesforce reported for the query by their lowercased full path (`contacts.cases.subject`).
 *
 * Each column's own `columnFullPath` is rewritten to be relative to the subquery it belongs to, because records
 * within a subquery hold plain field keys (`Subject`), not the full path.
 */
function registerQueryColumns(
  columns: Maybe<QueryResultsColumn[]>,
  parentRelationshipPath: string,
  subqueryRelationshipPaths: Set<string>,
  output: Record<string, QueryResultsColumn>,
) {
  (columns || []).forEach((column) => {
    const fullPath = column.columnFullPath;
    // Salesforce omits childColumnPaths for a subquery that returned no rows, so fall back to the parsed query
    // to keep the column typed as a subquery rather than plain text
    const childColumnPaths =
      !Array.isArray(column.childColumnPaths) && subqueryRelationshipPaths.has(fullPath.toLowerCase()) ? [] : column.childColumnPaths;

    output[fullPath.toLowerCase()] = {
      ...column,
      childColumnPaths,
      columnFullPath: parentRelationshipPath ? fullPath.slice(parentRelationshipPath.length + 1) : fullPath,
    } as QueryResultsColumn;

    if (Array.isArray(childColumnPaths)) {
      registerQueryColumns(childColumnPaths, fullPath, subqueryRelationshipPaths, output);
    }
  });
}

function getQueryResultColumn({
  field,
  subqueryRelationshipPath,
  queryColumnsByPath,
  isSubquery,
  fieldMetadata,
  allowEdit = true,
}: {
  field: string;
  /** Relationship path of the subquery this column belongs to, empty for a column on the root object */
  subqueryRelationshipPath?: string;
  queryColumnsByPath: Record<string, QueryResultsColumn>;
  isSubquery: boolean;
  fieldMetadata?: Maybe<Record<string, Field>>;
  allowEdit?: boolean;
}): ColumnWithFilter<RowWithKey> {
  const column: Mutable<ColumnWithFilter<RowWithKey>> = {
    name: field,
    key: field,
    cellClass: (row: any) => {
      // Use the resolved column key (set to columnFullPath below) so post-save errors mapped by column key
      // line up; for editable columns it equals `field`.
      const key = column.key;
      const classes = ['slds-truncate'];
      if (row._touchedColumns instanceof Set && (row._touchedColumns as Set<string>).has(key) && row[key] !== row._record?.[key]) {
        classes.push('slds-is-edited');
      }
      // Error/warning rings key off the per-field maps (NOT the dirty check) so a save error on a
      // since-reverted cell still flags, and a server-rejected non-touched field can also show.
      if (row._fieldErrors?.[key]) {
        classes.push('active-item-error');
      } else if (row._fieldWarnings?.[key]) {
        classes.push('active-item-warning');
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
  if (subqueryRelationshipPath) {
    fieldLowercase = `${subqueryRelationshipPath.toLowerCase()}.${fieldLowercase}`;
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
  if (!subqueryRelationshipPath && !queryResultColumn?.aggregate && resolvedType === 'text' && isNameField) {
    updateColumnFromType(column, 'salesforceName');
  }

  // Stash the Salesforce Field describe (when available) on the column's opaque meta bag so consumers
  // (e.g. the "View field metadata" header menu) can reach it. Looks up by the resolved column key with
  // a fallback to the bare field name — mirrors how `updateColumnWithEditMode` / the name-field check
  // resolve metadata. Subquery columns pass their relationship-scoped map as `fieldMetadata`.
  const fieldDescribe = fieldMetadata?.[column.key.toLowerCase()] ?? fieldMetadata?.[field.toLowerCase()];
  if (fieldDescribe) {
    column.meta = { field: fieldDescribe };
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

export function setColumnFromType<T extends object>(
  key: string,
  fieldType: ColumnType,
  defaultProps?: Partial<Mutable<ColumnWithFilter<T>>>,
) {
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

  // Editable cells can carry client-validation / save errors — wrap the display renderer so the cell
  // shows a tooltipped error/warning icon (text columns have no renderCell, so the wrapper falls back
  // to rendering the raw value). The non-editable early-return above means only editable columns reach here.
  column.renderCell = withCellValidation(column.renderCell);
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
      const normalizedKey = col.key?.toLowerCase();
      const label = normalizedKey ? fieldMetadata[normalizedKey]?.label : undefined;
      if (label) {
        return { ...col, name: `${col.name} (${label})` };
      }
      return col;
    });
  }
  return columnDefinitions;
}
