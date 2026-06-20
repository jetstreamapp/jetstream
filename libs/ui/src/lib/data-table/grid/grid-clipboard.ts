/* eslint-disable @typescript-eslint/no-explicit-any */
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { ContextAction, ContextMenuActionData, RowWithKey } from './grid-types';

/**
 * Clipboard copy helpers for the table context menu. Ported verbatim from the legacy data-table-utils
 * (no react-data-grid dependency). `copyGenericTableDataToClipboard` works with plain row data;
 * `copySalesforceRecordTableDataToClipboard` assumes a `_record` indirection on each row.
 */

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
