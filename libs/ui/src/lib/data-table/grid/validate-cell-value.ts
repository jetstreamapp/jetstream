import { ErrorResult, Field, Maybe } from '@jetstream/types';
import { isValid as isValidDate } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { CellValidationResult, ColumnWithFilter, RowSalesforceRecordWithKey } from './grid-types';

/**
 * Pure (React-free) validation + error-shaping helpers for the editable Salesforce records table.
 *
 * Two concerns live here:
 *  1. CLIENT validation of edited/pasted values against Salesforce field metadata — `validateCellValue`
 *     / `validateRow`. `error` results BLOCK save and are reserved for unambiguous, certain rejections
 *     (value too long, required field cleared, number exceeding its precision). `warning` results are
 *     advisory only and still allow a save attempt — type mismatches the server may reject (non-numeric
 *     number, invalid date), value not in the picklist, malformed Id, etc.
 *  2. Mapping a SERVER save response back onto the row at field + record level — `mapSaveErrorsToRow`,
 *     `summarizeRowErrors`, `getRowErrorMessages`.
 *
 * Rules are intentionally conservative: anything fuzzy or that the user might legitimately want to push to
 * the server anyway is a warning, never a blocking error (the server stays the source of truth).
 */

const isEmptyValue = (value: unknown): boolean => value === null || value === undefined || value === '';

/** Loose 15- or 18-char alphanumeric Salesforce Id shape (advisory only). */
const SALESFORCE_ID_SHAPE = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const STRING_TYPES = new Set<Field['type']>(['string', 'textarea', 'url', 'email', 'phone', 'combobox', 'encryptedstring']);
const NUMBER_TYPES = new Set<Field['type']>(['int', 'double', 'currency', 'percent']);

/** Validate a single (already-coerced) cell value against its field metadata. */
export function validateCellValue(value: unknown, field: Maybe<Field>): CellValidationResult {
  // No metadata, or a field that can't be hand-edited anyway — nothing to validate.
  if (!field || field.calculated || field.autoNumber) {
    return {};
  }

  if (isEmptyValue(value)) {
    // Clearing a required (non-nillable) updateable field is a blocking error. This table only ever
    // UPDATES records and `defaultedOnCreate` defaults are applied on insert only, so the server will
    // reject the null regardless of any create-time default. Booleans are never "empty" (false is a
    // value), so skip them.
    if (!field.nillable && field.updateable && field.type !== 'boolean') {
      return { error: `${field.label} is required.` };
    }
    return {};
  }

  if (STRING_TYPES.has(field.type)) {
    if (field.length > 0 && typeof value === 'string' && value.length > field.length) {
      return { error: `Exceeds the maximum length of ${field.length} characters (currently ${value.length}).` };
    }
    return {};
  }

  if (NUMBER_TYPES.has(field.type)) {
    return validateNumber(value, field);
  }

  if (field.type === 'date' || field.type === 'datetime') {
    const parsed = typeof value === 'string' ? parseISO(value) : value instanceof Date ? value : null;
    if (!parsed || !isValidDate(parsed)) {
      // A type mismatch the server will most likely reject — surface as a warning, not a blocking error, so
      // the user can still attempt the save (the server stays the source of truth).
      return { warning: `Not a valid ${field.type === 'date' ? 'date' : 'date/time'} — may fail to save.` };
    }
    return {};
  }

  if (field.type === 'picklist' || field.type === 'multipicklist') {
    return validatePicklist(value, field);
  }

  if (field.type === 'reference' || field.type === 'id') {
    if (typeof value === 'string' && value && !SALESFORCE_ID_SHAPE.test(value)) {
      return { warning: `"${value}" does not look like a valid Salesforce Id.` };
    }
    return {};
  }

  return {};
}

function validateNumber(value: unknown, field: Field): CellValidationResult {
  const stringValue = String(value).trim().replace(/,/g, '');
  if (stringValue === '') {
    return {};
  }
  const numberValue = Number(stringValue);
  if (!Number.isFinite(numberValue)) {
    // A non-numeric value is a type mismatch the server will most likely reject — surface as a warning, not
    // a blocking error, so the user can still attempt the save (the server stays the source of truth).
    return { warning: `"${value}" is not a valid number — may fail to save.` };
  }
  // `precision` = total significant digits, `scale` = decimal places, so the integer part may hold
  // `precision - scale` digits. Scale itself is not enforced (Salesforce rounds), keeping this lenient.
  if (field.precision != null) {
    const maxIntegerDigits = field.precision - (field.scale ?? 0);
    const absValue = Math.abs(numberValue);
    const integerDigits = absValue < 1 ? 0 : Math.floor(absValue).toString().length;
    if (maxIntegerDigits >= 0 && integerDigits > maxIntegerDigits) {
      return { error: `Number is too large (max ${maxIntegerDigits} digits before the decimal point).` };
    }
  }
  return {};
}

function validatePicklist(value: unknown, field: Field): CellValidationResult {
  if (!field.picklistValues || !field.picklistValues.length) {
    return {};
  }
  const validValues = new Set(field.picklistValues.map((entry) => entry.value));
  const activeValues = new Set(field.picklistValues.filter((entry) => entry.active).map((entry) => entry.value));
  const segments = (field.type === 'multipicklist' ? String(value).split(';') : [String(value)])
    .map((segment) => segment.trim())
    .filter(Boolean);

  const notInPicklist = segments.filter((segment) => !validValues.has(segment));
  if (notInPicklist.length) {
    return { warning: `Value not in the picklist: ${notInPicklist.join(', ')}.` };
  }
  const inactive = segments.filter((segment) => !activeValues.has(segment));
  if (inactive.length) {
    return { warning: `Inactive picklist value: ${inactive.join(', ')}.` };
  }
  return {};
}

/**
 * Validate every touched-and-changed cell of a row. Only changed cells are checked — untouched values
 * came from Salesforce and are assumed valid. Returns per-column error + warning maps.
 */
export function validateRow(
  row: RowSalesforceRecordWithKey,
  fieldMetadata: Maybe<Record<string, Field>>,
): { fieldErrors: Record<string, string>; fieldWarnings: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const fieldWarnings: Record<string, string> = {};
  if (!fieldMetadata || !(row._touchedColumns instanceof Set)) {
    return { fieldErrors, fieldWarnings };
  }
  for (const columnKey of row._touchedColumns) {
    if (row[columnKey] === row._record?.[columnKey]) {
      continue;
    }
    const { error, warning } = validateCellValue(row[columnKey], fieldMetadata[columnKey.toLowerCase()]);
    if (error) {
      fieldErrors[columnKey] = error;
    } else if (warning) {
      fieldWarnings[columnKey] = warning;
    }
  }
  return { fieldErrors, fieldWarnings };
}

/**
 * Map a Salesforce save `ErrorResult` onto a row. Each error whose `fields[]` matches a visible column
 * (case-insensitive) becomes a cell-level error; errors with no field, or referencing a field that is
 * not a visible column, fall back to row-level `recordErrors`.
 */
export function mapSaveErrorsToRow(
  errorResult: ErrorResult,
  columns: ColumnWithFilter<RowSalesforceRecordWithKey>[],
): { fieldErrors: Record<string, string>; recordErrors: string[] } {
  const fieldErrors: Record<string, string> = {};
  const recordErrors: string[] = [];
  const columnKeyByLower = new Map<string, string>();
  columns.forEach((column) => {
    if (column.key) {
      columnKeyByLower.set(column.key.toLowerCase(), column.key);
    }
  });

  for (const error of errorResult.errors ?? []) {
    const message = error.message || error.statusCode || 'Unknown error';
    const matchedKeys = (error.fields ?? [])
      .map((fieldName) => columnKeyByLower.get(fieldName.toLowerCase()))
      .filter((key): key is string => !!key);
    if (matchedKeys.length) {
      // Keep the first error per field; still surface every message at the record level via the summary.
      matchedKeys.forEach((key) => {
        if (!fieldErrors[key]) {
          fieldErrors[key] = message;
        }
      });
    } else {
      recordErrors.push(message);
    }
  }
  return { fieldErrors, recordErrors };
}

/** Join all field + record errors into a single newline-delimited summary for the derived `_saveError`. */
export function summarizeRowErrors(fieldErrors: Record<string, string>, recordErrors: string[]): Maybe<string> {
  const messages = [...Object.values(fieldErrors), ...recordErrors];
  return messages.length ? messages.join('\n') : null;
}

/** Flat list of all error messages on a row (field + record), for the row-level error popovers. */
export function getRowErrorMessages(row: RowSalesforceRecordWithKey): string[] {
  const fieldErrors = row._fieldErrors ? Object.values(row._fieldErrors) : [];
  const recordErrors = row._recordErrors ?? [];
  if (fieldErrors.length || recordErrors.length) {
    return [...fieldErrors, ...recordErrors];
  }
  return row._saveError ? [row._saveError] : [];
}
