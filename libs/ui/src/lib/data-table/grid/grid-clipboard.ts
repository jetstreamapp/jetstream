/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { getSortedFilteredLeafRows } from './grid-row-utils';
import { ContextAction, ContextMenuActionData, RowWithKey, TanstackColumn, TanstackRow, TanstackTable } from './grid-types';

/**
 * Clipboard copy helpers for the table context menu.
 *
 * Two families live here:
 *  - `copyGridDataToClipboard` — the grid's own implementation, driven by the TanStack table model. Used
 *    for the copy menu every table gets by default, and for the group-row menu.
 *  - `copyGenericTableDataToClipboard` / `copySalesforceRecordTableDataToClipboard` — the consumer-facing
 *    helpers (ported verbatim from the legacy data-table-utils), driven by the plain row objects handed
 *    to a `contextMenuAction`. The Salesforce variant assumes a `_record` indirection on each row.
 */

/**
 * A cell's value as the grid understands it: the author column's `getValue` when provided (the same
 * accessor the cell renders from), otherwise the raw row property.
 */
export function getCellValue<TRow extends object>(row: TanstackRow<TRow>, column: TanstackColumn<TRow>): unknown {
  // Synthetic group header rows have no original row data.
  if (row.original === null || row.original === undefined) {
    return null;
  }
  const authorColumn = column.columnDef.meta?.jetstream?.column;
  return authorColumn?.getValue
    ? authorColumn.getValue({ row: row.original, column: authorColumn })
    : (row.original as Record<string, unknown>)[column.id];
}

/** A cell's copyable text — `getCellValue` stringified (objects/arrays as JSON, nullish as empty). */
export function getCellText<TRow extends object>(row: TanstackRow<TRow>, column: TanstackColumn<TRow>): string {
  const value = getCellValue(row, column);
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Display label for a column header. Falls back to the string header / column id when the author's
 * `name` is a ReactNode. */
export function getColumnHeaderText<TRow extends object>(column: TanstackColumn<TRow>): string {
  const name = column.columnDef.meta?.jetstream?.column?.name;
  if (typeof name === 'string') {
    return name;
  }
  const header = column.columnDef.header;
  if (typeof header === 'string') {
    return header;
  }
  return column.id;
}

/** What a grid-owned copy actually put on the clipboard, for the polite live-region announcement. */
export interface GridCopyResult {
  rowCount: number;
  columnCount: number;
}

/** Visible columns carrying copyable data — the select/action columns hold controls, not values. */
function getCopyableColumns<TRow extends object>(table: TanstackTable<TRow>): TanstackColumn<TRow>[] {
  return table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.jetstream?.cellKind === 'data');
}

/**
 * Copy a rows × columns region.
 *
 * Excel/CSV records are keyed by synthetic field names (`c0`, `c1`, …) because the downstream copy
 * utilities resolve field names as lodash paths — a real column id like `Account.Name` would be read as
 * a nested path instead of a literal key. That also rules out letting them emit the header row, so the
 * header is prepended as a normal record. JSON does no path resolution, so it keeps the real column ids
 * as keys and the un-stringified values.
 */
function copyRegion<TRow extends object>(
  rows: TanstackRow<TRow>[],
  columns: TanstackColumn<TRow>[],
  format: 'excel' | 'csv' | 'json',
  includeHeader: boolean,
): GridCopyResult | null {
  if (!rows.length || !columns.length) {
    return null;
  }
  const result: GridCopyResult = { rowCount: rows.length, columnCount: columns.length };

  if (format === 'json') {
    const records = rows.map((row) =>
      columns.reduce<Record<string, unknown>>((record, column) => {
        record[column.id] = getCellValue(row, column);
        return record;
      }, {}),
    );
    void copyRecordsToClipboard(records, 'json');
    return result;
  }

  const fields = columns.map((_, index) => `c${index}`);
  const records: Record<string, string>[] = [];
  if (includeHeader) {
    records.push(
      columns.reduce<Record<string, string>>((record, column, index) => {
        record[fields[index]] = getColumnHeaderText(column);
        return record;
      }, {}),
    );
  }
  for (const row of rows) {
    records.push(
      columns.reduce<Record<string, string>>((record, column, index) => {
        record[fields[index]] = getCellText(row, column);
        return record;
      }, {}),
    );
  }
  void copyRecordsToClipboard(records, format, fields, false);
  return result;
}

export interface GridCopyRequest<TRow extends object> {
  table: TanstackTable<TRow>;
  action: ContextAction;
  /** The right-clicked row — required by the cell/row-scoped actions. */
  row?: TanstackRow<TRow> | null;
  /** The right-clicked column — required by the cell/column-scoped actions. */
  column?: TanstackColumn<TRow> | null;
}

/**
 * The grid's own implementation of the standard `TABLE_CONTEXT_MENU_ITEMS` actions, used for the copy
 * menu a table gets when it supplies no `contextMenuItems` of its own.
 *
 * Unlike the consumer-facing helpers, which index raw row objects by column key, this reads through the
 * table model — so it honors `getValue`, column reordering and visibility, and the filtered + sorted row
 * order the user is actually looking at.
 */
export function copyGridDataToClipboard<TRow extends object>({ table, action, row, column }: GridCopyRequest<TRow>): GridCopyResult | null {
  const columns = getCopyableColumns(table);
  const rows = getSortedFilteredLeafRows(table);
  switch (action) {
    case 'COPY_CELL':
      return row && column ? copyRegion([row], [column], 'excel', false) : null;
    case 'COPY_ROW_EXCEL':
      return row ? copyRegion([row], columns, 'excel', true) : null;
    case 'COPY_ROW_JSON':
      return row ? copyRegion([row], columns, 'json', false) : null;
    case 'COPY_COL':
      return column ? copyRegion(rows, [column], 'excel', true) : null;
    case 'COPY_COL_NO_HEADER':
      return column ? copyRegion(rows, [column], 'excel', false) : null;
    case 'COPY_COL_JSON':
      return column ? copyRegion(rows, [column], 'json', false) : null;
    case 'COPY_TABLE':
      return copyRegion(rows, columns, 'excel', true);
    case 'COPY_TABLE_CSV':
      return copyRegion(rows, columns, 'csv', true);
    case 'COPY_TABLE_JSON':
      return copyRegion(rows, columns, 'json', false);
    default:
      return null;
  }
}

/** Copy every data row beneath a group header row — the grid-owned action on a group row right-click. */
export function copyGridGroupRowsToClipboard<TRow extends object>(
  table: TanstackTable<TRow>,
  groupRow: TanstackRow<TRow>,
  includeHeader: boolean,
): GridCopyResult | null {
  return copyRegion(groupRow.getLeafRows(), getCopyableColumns(table), 'excel', includeHeader);
}

export function copyGenericTableDataToClipboard<T extends Record<string, any>>(
  action: ContextAction,
  fields: string[],
  { row, rows, column, columns }: ContextMenuActionData<T>,
) {
  let includeHeader = true;
  let recordsToCopy: unknown[] = [];
  const fieldsSet = new Set(fields);
  let fieldsToCopy = columns.map((column) => column.key).filter((field) => fieldsSet.has(field));
  let format: 'plain' | 'excel' | 'json' | 'csv' = 'plain';

  switch (action) {
    case 'COPY_CELL':
      includeHeader = false;
      fieldsToCopy = [column.key];
      recordsToCopy = [row];
      break;
    case 'COPY_ROW_EXCEL':
      format = 'excel';
      recordsToCopy = [row];
      break;
    case 'COPY_ROW_JSON':
      recordsToCopy = [row];
      format = 'json';
      break;
    case 'COPY_COL':
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = rows.map((row) => ({ [column.key]: row[column.key] }));
      format = 'excel';
      break;
    case 'COPY_COL_JSON':
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = rows.map((row) => ({ [column.key]: row[column.key] }));
      format = 'json';
      break;
    case 'COPY_COL_NO_HEADER':
      includeHeader = false;
      fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
      recordsToCopy = rows.map((row) => ({ [column.key]: row[column.key] }));
      format = 'plain';
      break;
    case 'COPY_TABLE':
      recordsToCopy = rows;
      break;
    case 'COPY_TABLE_JSON':
      recordsToCopy = rows;
      format = 'json';
      break;
    case 'COPY_TABLE_CSV':
      recordsToCopy = rows;
      format = 'csv';
      break;
    default:
      break;
  }
  writeRecords(recordsToCopy, fieldsToCopy, format, includeHeader);
}

export function copySalesforceRecordTableDataToClipboard(
  action: ContextAction,
  fields: string[],
  { row, rows, column, columns }: ContextMenuActionData<RowWithKey>,
) {
  let includeHeader = true;
  let recordsToCopy: unknown[] = [];
  const records = rows.map((row) => (row as any)._record);
  const fieldsSet = new Set(fields);
  // Prefer columns order over fields to account for reordering.
  let fieldsToCopy = columns.map((column) => column.key).filter((field) => fieldsSet.has(field));
  let format: 'plain' | 'excel' | 'json' | 'csv' = 'plain';

  switch (action) {
    case 'COPY_CELL':
      includeHeader = false;
      fieldsToCopy = [column.key];
      recordsToCopy = [(row as any)._record];
      break;
    case 'COPY_ROW_EXCEL':
      format = 'excel';
      recordsToCopy = [(row as any)._record];
      break;
    case 'COPY_ROW_JSON':
      recordsToCopy = [(row as any)._record];
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
    case 'COPY_TABLE_CSV':
      recordsToCopy = records;
      format = 'csv';
      break;
    default:
      break;
  }
  writeRecords(recordsToCopy, fieldsToCopy, format, includeHeader);
}

function writeRecords(
  recordsToCopy: unknown[],
  fieldsToCopy: string[],
  format: 'plain' | 'excel' | 'json' | 'csv',
  includeHeader: boolean,
) {
  if (!recordsToCopy.length) {
    return;
  }
  if (format === 'json') {
    const filteredRecords = recordsToCopy.map((record) =>
      fieldsToCopy.reduce<Record<string, unknown>>((output, field) => {
        output[field] = (record as Record<string, unknown>)[field];
        return output;
      }, {}),
    );
    copyRecordsToClipboard(filteredRecords, 'json');
  } else if (format === 'csv') {
    copyRecordsToClipboard(recordsToCopy, 'csv', fieldsToCopy, includeHeader);
  } else {
    copyRecordsToClipboard(recordsToCopy, 'excel', fieldsToCopy, includeHeader);
  }
}
