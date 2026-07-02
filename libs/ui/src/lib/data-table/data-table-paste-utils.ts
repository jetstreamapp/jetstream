import { Field, Maybe } from '@jetstream/types';
import { formatISO } from 'date-fns/formatISO';
import { isValid as isValidDate } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { GridCellRef, PasteTargetCell, RowSalesforceRecordWithKey } from './grid/grid-types';
import { summarizeRowErrors, validateRow } from './grid/validate-cell-value';

/**
 * Consumer-side (Salesforce-aware) paste helpers. The generic grid resolves WHICH editable cells receive
 * a value; this module coerces the raw clipboard strings into the per-type shapes the inline editors
 * write, applies them to the rows, and re-runs validation — mirroring the normal edit-commit flow.
 */

const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'x', 't', 'checked']);

function coerceBoolean(raw: string): boolean {
  return BOOLEAN_TRUE_VALUES.has(raw.trim().toLowerCase());
}

/** Numbers are stored as strings (matching the text editor used for numeric fields); commas are stripped
 * and the value is kept verbatim on failure so validation can flag it and the user can see/fix it. */
function coerceNumber(raw: string): string {
  return raw.trim().replace(/,/g, '');
}

function parseFlexibleDate(value: string): Date | null {
  const iso = parseISO(value);
  if (isValidDate(iso)) {
    return iso;
  }
  const native = new Date(value);
  return isValidDate(native) ? native : null;
}

/** Dates use the same ISO conventions as the date editor; unparseable input is kept raw so validation flags it. */
function coerceDate(raw: string, kind: 'date' | 'datetime'): string {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  const parsed = parseFlexibleDate(trimmed);
  if (!parsed) {
    return raw;
  }
  return kind === 'date' ? formatISO(parsed, { representation: 'date' }) : formatISO(parsed);
}

/**
 * Convert a raw clipboard string into the value shape the inline editor for this field would write
 * (real boolean, ISO date/datetime, `;`-joined multipicklist, comma-stripped numeric string, else raw).
 */
export function coercePastedValue(raw: string, field: Maybe<Field>): unknown {
  if (!field) {
    return raw;
  }
  switch (field.type) {
    case 'boolean':
      return coerceBoolean(raw);
    case 'int':
    case 'double':
    case 'currency':
    case 'percent':
      return coerceNumber(raw);
    case 'date':
      return coerceDate(raw, 'date');
    case 'datetime':
      return coerceDate(raw, 'datetime');
    case 'multipicklist':
      return raw
        .split(/[;,]/)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join(';');
    default:
      // string, textarea, url, email, phone, picklist, reference, id, etc. — stored as-is.
      return raw;
  }
}

function groupCellsByRowKey<TCell extends GridCellRef>(cells: TCell[]): Map<string, TCell[]> {
  const byRowKey = new Map<string, TCell[]>();
  for (const cell of cells) {
    const existing = byRowKey.get(cell.rowKey);
    if (existing) {
      existing.push(cell);
    } else {
      byRowKey.set(cell.rowKey, [cell]);
    }
  }
  return byRowKey;
}

/** Re-run validation on a row after its values/touched-set changed, returning a new row object. */
function revalidateRow(row: RowSalesforceRecordWithKey, fieldMetadata: Maybe<Record<string, Field>>): RowSalesforceRecordWithKey {
  const { fieldErrors, fieldWarnings } = validateRow(row, fieldMetadata);
  const recordErrors = row._recordErrors ?? [];
  return {
    ...row,
    _fieldErrors: fieldErrors,
    _fieldWarnings: fieldWarnings,
    _recordErrors: recordErrors,
    _saveError: summarizeRowErrors(fieldErrors, recordErrors),
  };
}

/**
 * Apply pasted cells to the row set: coerce each value, mark the column touched, and re-run validation for
 * the affected rows (mirroring `applyValidationToRow` in the consumer). Untouched rows are returned as-is.
 * Returns a NEW array with new objects only for affected rows (the GridCell memo keys on row identity).
 */
export function applyPasteCellsToRows(
  rows: RowSalesforceRecordWithKey[],
  cells: PasteTargetCell[],
  fieldMetadata: Maybe<Record<string, Field>>,
): RowSalesforceRecordWithKey[] {
  if (!cells.length) {
    return rows;
  }
  const cellsByRowKey = groupCellsByRowKey(cells);

  return rows.map((row) => {
    const rowCells = cellsByRowKey.get(row._key);
    if (!rowCells) {
      return row;
    }
    const touched = new Set(row._touchedColumns);
    const updated: RowSalesforceRecordWithKey = { ...row };
    for (const cell of rowCells) {
      updated[cell.columnKey] = coercePastedValue(cell.value, fieldMetadata?.[cell.columnKey.toLowerCase()]);
      touched.add(cell.columnKey);
    }
    updated._touchedColumns = touched;
    return revalidateRow(updated, fieldMetadata);
  });
}

/**
 * Revert the given cells to their original (`_record`) values: restore each value, drop the column from
 * `_touchedColumns`, and re-validate. Returns a new array with new objects only for affected rows.
 */
export function revertCellsInRows(
  rows: RowSalesforceRecordWithKey[],
  cells: GridCellRef[],
  fieldMetadata: Maybe<Record<string, Field>>,
): RowSalesforceRecordWithKey[] {
  if (!cells.length) {
    return rows;
  }
  const cellsByRowKey = groupCellsByRowKey(cells);

  return rows.map((row) => {
    const rowCells = cellsByRowKey.get(row._key);
    if (!rowCells) {
      return row;
    }
    const touched = new Set(row._touchedColumns);
    const updated: RowSalesforceRecordWithKey = { ...row };
    for (const cell of rowCells) {
      updated[cell.columnKey] = row._record?.[cell.columnKey];
      touched.delete(cell.columnKey);
    }
    updated._touchedColumns = touched;
    return revalidateRow(updated, fieldMetadata);
  });
}
