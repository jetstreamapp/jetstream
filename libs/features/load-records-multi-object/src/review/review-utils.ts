import { LoadMultiObjectData, LoadMultiObjectDataError, LoadMultiObjectGroupInfo } from '../load-records-multi-object-types';
import { getReferenceId } from '../load-records-multi-object-utils';

/** Excel rows start at 6 for data (row 5 is the header row) */
const DATA_START_EXCEL_ROW = 6;

export interface SheetPreviewRow {
  _key: string;
  _referenceId: string | null;
  /** Friendly group label, e.g. "Group 3" - null while the graph could not be computed */
  _group: string | null;
  _groupSize: number | null;
  /** Per-cell errors keyed by column key - drives the red ring + tooltip via withCellValidation */
  _fieldErrors?: Record<string, string>;
  /** Row-level error text - rendered by the standalone record-error column */
  status?: string;
  severity?: 'error' | 'none';
  [header: string]: unknown;
}

export interface SheetPreviewData {
  rows: SheetPreviewRow[];
  /** Errors with no grid cell to attach to (B1/B2/B3 config, header row, empty sheet, unmappable) */
  bannerErrors: LoadMultiObjectDataError[];
  /** Non-blocking problems for this sheet, e.g. columns that will be skipped */
  warnings: LoadMultiObjectDataError[];
  /** Headers that will not be loaded - rendered in red so the skipped columns are obvious in the grid */
  skippedHeaders: Set<string>;
  /** Total number of distinct blocking errors attributed to this sheet (banner + inline) */
  errorCount: number;
  hasRowErrors: boolean;
}

/** Assign stable, human-friendly group numbers by order of first appearance */
export function getGroupNumbersByGraphId(groupsByRefId: Record<string, LoadMultiObjectGroupInfo>): Record<string, number> {
  const groupNumbers: Record<string, number> = {};
  let nextNumber = 1;
  Object.values(groupsByRefId).forEach(({ graphId }) => {
    if (!groupNumbers[graphId]) {
      groupNumbers[graphId] = nextNumber++;
    }
  });
  return groupNumbers;
}

export function getGroupSummary(groupsByRefId: Record<string, LoadMultiObjectGroupInfo>) {
  const sizeByGraphId: Record<string, number> = {};
  Object.values(groupsByRefId).forEach(({ graphId, size }) => {
    sizeByGraphId[graphId] = size;
  });
  const sizes = Object.values(sizeByGraphId);
  return {
    groupCount: sizes.length,
    largestGroupSize: sizes.length ? Math.max(...sizes) : 0,
  };
}

/**
 * Combine a parsed dataset with its errors and group info into renderable grid rows.
 * Errors that can be located map onto specific cells/rows; everything else lands in bannerErrors.
 */
export function buildSheetPreviewData({
  dataset,
  errors,
  groupsByRefId,
  groupNumbersByGraphId,
}: {
  dataset: LoadMultiObjectData;
  /** All errors attributed to this worksheet (dataset errors + graph errors) */
  errors: LoadMultiObjectDataError[];
  groupsByRefId: Record<string, LoadMultiObjectGroupInfo>;
  groupNumbersByGraphId: Record<string, number>;
}): SheetPreviewData {
  const referenceColumnKey = dataset.referenceColumnHeader || 'Reference Id';

  const rows: SheetPreviewRow[] = dataset.data.map((record, i) => {
    const referenceId = getReferenceId(record, referenceColumnKey);
    const groupInfo = referenceId ? groupsByRefId[referenceId] : null;
    const groupNumber = groupInfo ? groupNumbersByGraphId[groupInfo.graphId] : null;
    return {
      ...record,
      _key: `${dataset.worksheet}:${i}`,
      _referenceId: referenceId,
      _group: groupNumber ? `Group ${groupNumber}` : null,
      _groupSize: groupInfo?.size ?? null,
    };
  });

  const bannerErrors: LoadMultiObjectDataError[] = [];
  const warnings = errors.filter(({ severity }) => severity === 'warning');
  const blockingErrors = errors.filter(({ severity }) => severity !== 'warning');
  const skippedHeaders = new Set(warnings.filter(({ header }) => !!header).map(({ header }) => header as string));

  function addFieldError(rowIndex: number, columnKey: string, message: string) {
    const row = rows[rowIndex];
    if (!row) {
      return false;
    }
    row._fieldErrors = {
      ...row._fieldErrors,
      [columnKey]: row._fieldErrors?.[columnKey] ? `${row._fieldErrors[columnKey]}\n${message}` : message,
    };
    return true;
  }

  function addRowError(rowIndex: number, message: string) {
    const row = rows[rowIndex];
    if (!row) {
      return false;
    }
    row.status = row.status ? `${row.status}\n${message}` : message;
    row.severity = 'error';
    return true;
  }

  blockingErrors.forEach((error) => {
    const { locationType, location, rowIndexes, header, message } = error;

    if (rowIndexes?.length) {
      const mapped = rowIndexes.map((rowIndex) => {
        if (locationType === 'ROW') {
          return addRowError(rowIndex, message);
        }
        // CELL errors with row indexes are Reference Id problems (column A); COLUMN errors carry the header
        return addFieldError(rowIndex, header || referenceColumnKey, message);
      });
      if (!mapped.some(Boolean)) {
        bannerErrors.push(error);
      }
      return;
    }

    // ROW errors from parse-time carry only the Excel row number
    if (locationType === 'ROW' && location) {
      const excelRow = parseInt(location, 10);
      if (excelRow >= DATA_START_EXCEL_ROW && addRowError(excelRow - DATA_START_EXCEL_ROW, message)) {
        return;
      }
    }

    bannerErrors.push(error);
  });

  return {
    rows,
    bannerErrors,
    warnings,
    skippedHeaders,
    errorCount: blockingErrors.length,
    hasRowErrors: rows.some(({ status, _fieldErrors }) => !!status || !!_fieldErrors),
  };
}

/**
 * Stable identity for a set of warnings, used as a dismissal reset key so that dismissing a warning
 * does not hide the warnings from the next file the user uploads.
 */
export function getWarningsKey(warnings: LoadMultiObjectDataError[]): string {
  return warnings.map(({ worksheet, message }) => `${worksheet}:${message}`).join('|');
}

/**
 * Build an element id scoped to a worksheet.
 * Worksheet names allow spaces and punctuation, neither of which is valid in an element id. Each invalid
 * character is encoded rather than collapsed to a dash, so two distinct worksheets ("A B" and "A-B") cannot
 * produce the same id - every worksheet is mounted at once, so a collision would break label associations.
 */
export function getWorksheetElementId(prefix: string, worksheet: string): string {
  return `${prefix}-${worksheet.replace(/[^a-zA-Z0-9_-]/g, (character) => `_${character.charCodeAt(0)}_`)}`;
}

/** Human-readable location suffix for an error, e.g. "(Cell B1)" */
export function getErrorLocationLabel({ location, locationType }: LoadMultiObjectDataError): string | null {
  if (!location) {
    return null;
  }
  switch (locationType) {
    case 'CELL':
      return `(Cell ${location})`;
    case 'ROW':
      return `(Row ${location})`;
    case 'COLUMN':
      return `(Column ${location})`;
    default:
      return null;
  }
}
