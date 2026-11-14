/* eslint-disable @typescript-eslint/no-explicit-any */
import { MIME_TYPES } from '@jetstream/shared/constants';
import { sanitizeSheetName, type CellValue, type SourceInput } from '@jetstreamapp/simple-excel';
import * as XLSX from 'xlsx';
import {
  LOAD_MULTI_OBJECT_TEMPLATE_LAYOUT,
  type LoadMultiObjectTemplateSheet,
  type LoadMultiObjectTemplateWorkbook,
} from './load-multi-object-template.utils';
import {
  convertArrayOfObjectToArrayOfArray,
  EXCEL_MAX_CELL_CHARS,
  EXCEL_TRUNCATION_SUFFIX,
  type ParsedFile,
  type PrepareExcelFileOptions,
} from './shared-ui-utils';

/**
 * The SheetJS implementation of every spreadsheet read and write, used while the `simple-excel-engine` feature flag
 * is off.
 *
 * Nothing imports this file statically: each entry point in `shared-ui-utils.ts` and
 * `load-multi-object-template.utils.ts` loads it with a dynamic import, so SheetJS is only downloaded by users who
 * are still on it. Delete this file, the `xlsx` dependency and the flag once the new engine is on for everyone.
 */

let codepageTablePromise: Promise<void> | undefined;

/**
 * Register the codepage table so SheetJS can read workbooks saved in legacy non-unicode encodings. The table is
 * fetched at most once per session.
 *
 * It is loaded lazily rather than imported, since it appears to have been failing to load for at
 * least one user, and skipped entirely in the browser extension.
 * https://github.com/jetstreamapp/jetstream/issues/211
 * https://git.sheetjs.com/sheetjs/sheetjs/issues/2900
 */
function ensureXlsxCodepageTable(): Promise<void> {
  if (globalThis.__IS_BROWSER_EXTENSION__) {
    return Promise.resolve();
  }
  codepageTablePromise ??= import('xlsx/dist/cpexcel.full.mjs').then((module) => XLSX.set_cptable(module)).catch(() => undefined);
  return codepageTablePromise;
}

async function readWorkbook(source: SourceInput): Promise<XLSX.WorkBook> {
  await ensureXlsxCodepageTable();
  return XLSX.read(await sourceToBytes(source), { cellText: false, cellDates: true, type: 'array' });
}

async function sourceToBytes(source: SourceInput): Promise<Uint8Array> {
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  if (source instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && source instanceof SharedArrayBuffer)) {
    return new Uint8Array(source);
  }
  throw new Error('The file could not be read.');
}

const SHEET_TO_JSON_OPTIONS = {
  dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
  defval: '',
  blankrows: false,
  rawNumbers: true,
} as const;

/** SheetJS side of `parseWorkbook`: the first worksheet (or the one the user picks) as records */
export async function parseWorkbookLegacy(
  source: SourceInput,
  options?: {
    onParsedMultipleWorkbooks?: (worksheets: string[]) => Promise<string>;
  },
): Promise<ParsedFile> {
  const workbook = await readWorkbook(source);
  if (workbook.SheetNames.length === 0) {
    return { data: [], headers: [], errors: [] };
  }
  let selectedSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (workbook.SheetNames.length > 1 && typeof options?.onParsedMultipleWorkbooks === 'function') {
    const sheetName = await options.onParsedMultipleWorkbooks(workbook.SheetNames);
    if (workbook.Sheets[sheetName]) {
      selectedSheet = workbook.Sheets[sheetName];
    }
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(selectedSheet, SHEET_TO_JSON_OPTIONS);
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  return {
    data,
    headers: headers.filter((field) => !field.startsWith('__empty')),
    errors: [],
  };
}

function isOversizedExcelCell(value: unknown): value is string {
  return typeof value === 'string' && value.length > EXCEL_MAX_CELL_CHARS;
}

/** A nested object that was not flattened. SheetJS would read it as one of its own cell objects and write nothing. */
function isObjectCell(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}

function truncateCell(value: string): string {
  return `${value.slice(0, EXCEL_MAX_CELL_CHARS - EXCEL_TRUNCATION_SUFFIX.length)}${EXCEL_TRUNCATION_SUFFIX}`;
}

/**
 * Makes every cell one SheetJS can write: an object that was not flattened becomes JSON, and a cell over Excel's
 * per-cell limit is truncated - SheetJS throws "Text length must not exceed 32767 characters" beyond it. Runs
 * immediately before the workbook is written, the peak-memory moment of an export, so rows are scanned first and
 * only rows that actually need a change are re-allocated. Rows are never mutated in place because callers may own
 * them.
 */
function prepareRowsForExcel(rows: any[][]): { rows: any[][]; truncatedCellCount: number } {
  const rowIndexesToRewrite = new Set<number>();
  rows.forEach((row, index) => {
    if (row.some((value) => isOversizedExcelCell(value) || isObjectCell(value))) {
      rowIndexesToRewrite.add(index);
    }
  });

  if (rowIndexesToRewrite.size === 0) {
    return { rows, truncatedCellCount: 0 };
  }

  let truncatedCellCount = 0;
  const rewriteCell = (cell: unknown) => {
    const value = isObjectCell(cell) ? JSON.stringify(cell) : cell;
    if (!isOversizedExcelCell(value)) {
      return value;
    }
    truncatedCellCount++;
    return truncateCell(value);
  };

  return {
    rows: rows.map((row, index) => (rowIndexesToRewrite.has(index) ? row.map(rewriteCell) : row)),
    truncatedCellCount,
  };
}

function workbookToBlob(workbook: XLSX.WorkBook, options?: XLSX.WritingOptions): Blob {
  // https://github.com/sheetjs/sheetjs#writing-options
  const workbookArrayBuffer: ArrayBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'array',
    // Compression=true is slower, but helps avoid "Invalid Array Length" errors on large files
    compression: false,
    ...options,
  });
  return new Blob([workbookArrayBuffer], { type: MIME_TYPES.XLSX_OPEN_OFFICE });
}

const COMPRESS_SHEET_ROW_COUNT = 10_000;

/**
 * SheetJS side of `prepareExcelFile`. The whole workbook is built in memory and written in one synchronous call, so
 * the writer options of the new engine do not apply: there is no progress to report and nothing to cancel once the
 * write has started.
 */
export async function prepareExcelFileLegacy(
  data: any,
  header: any,
  defaultSheetName = 'Records',
  options: PrepareExcelFileOptions = {},
): Promise<Blob> {
  const { onCellsTruncated, signal } = options;
  signal?.throwIfAborted();
  const workbook = XLSX.utils.book_new();
  // SheetJS throws on a sheet name Excel does not allow, or one that is already taken
  const takenSheetNames = new Set<string>();
  const appendSheet = (rows: any[][], sheetName: string) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows, { dense: true }), sanitizeSheetName(sheetName, takenSheetNames));
  };
  let compression = false;
  let truncatedCellCount = 0;

  /** Truncate over-limit cells for one sheet, accumulating the count across all sheets */
  function truncate(rows: any[][]): any[][] {
    const result = prepareRowsForExcel(rows);
    truncatedCellCount += result.truncatedCellCount;
    return result.rows;
  }

  if (Array.isArray(data)) {
    const sheetHeader: string[] = header || Object.keys(data[0] || {});
    // An empty export still gets its header row
    const rows = data.length > 0 ? convertArrayOfObjectToArrayOfArray(data, sheetHeader) : [sheetHeader];
    appendSheet(truncate(rows), defaultSheetName);
    compression = data.length > COMPRESS_SHEET_ROW_COUNT;
  } else {
    for (const [sheetName, values] of Object.entries<any[]>(data)) {
      if (!values?.length) {
        continue;
      }
      compression = compression || values.length > COMPRESS_SHEET_ROW_COUNT;
      const currentHeader: string[] | undefined = header?.[sheetName];
      const isArrayOfArray = !currentHeader && Array.isArray(values[0]);
      const rows = isArrayOfArray ? values : convertArrayOfObjectToArrayOfArray(values, currentHeader || Object.keys(values[0]));
      appendSheet(truncate(rows), sheetName);
    }
    if (workbook.SheetNames.length === 0) {
      // SheetJS refuses to write a workbook without a sheet
      appendSheet([], defaultSheetName);
    }
  }

  if (truncatedCellCount > 0) {
    onCellsTruncated?.(truncatedCellCount);
  }

  return workbookToBlob(workbook, { compression });
}

/** A sheet for `writeWorkbookLegacy`: plain rows plus the two decorations SheetJS community edition can write */
export interface LegacyWorksheet {
  name: string;
  rows: unknown[][];
  /** A1 ranges to merge, e.g. `B1:H1` */
  merges?: string[];
  /**
   * How many rows at the top column widths are not measured from (a merged group header would dwarf every column).
   * Every column those rows reach is at least the default width instead.
   */
  widthSkippedRowCount?: number;
  /** Excel number format for `Date` cells */
  dateFormat?: string;
}

const LEGACY_SKIPPED_ROW_WIDTH = 15;

/** Column widths from the widest value in each column, with `Date` cells measured as `dateFormat` renders them */
function getColumnWidths({ rows, widthSkippedRowCount = 0, dateFormat }: LegacyWorksheet): XLSX.ColInfo[] {
  const widths: number[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (rowIndex < widthSkippedRowCount) {
        widths[columnIndex] = LEGACY_SKIPPED_ROW_WIDTH;
        return;
      }
      const width = value instanceof Date && dateFormat ? dateFormat.length : `${value || ''}`.length;
      widths[columnIndex] = Math.max(widths[columnIndex] || 0, width);
    });
  });
  return widths.map((width): XLSX.ColInfo => ({ width: width + 2 }));
}

/**
 * Writes sheets that were assembled by hand (the Permission Manager export) with SheetJS. Sheets are built in dense
 * mode: otherwise SheetJS stores each cell as its own property on the worksheet object, and V8 caps a single object
 * near 8.4 million enumerable properties, which a large permission export passes.
 */
export async function writeWorkbookLegacy(
  sheets: LegacyWorksheet[],
  { onCellsTruncated }: Pick<PrepareExcelFileOptions, 'onCellsTruncated'> = {},
): Promise<Blob> {
  await ensureXlsxCodepageTable();
  const workbook = XLSX.utils.book_new();
  let truncatedCellCount = 0;

  for (const sheet of sheets) {
    const truncated = prepareRowsForExcel(sheet.rows);
    truncatedCellCount += truncated.truncatedCellCount;
    const worksheet = XLSX.utils.aoa_to_sheet(truncated.rows, {
      dense: true,
      ...(sheet.dateFormat ? { cellDates: true, dateNF: sheet.dateFormat } : {}),
    });
    worksheet['!cols'] = getColumnWidths({ ...sheet, rows: truncated.rows });
    worksheet['!merges'] = (sheet.merges ?? []).map((range) => XLSX.utils.decode_range(range));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  if (truncatedCellCount > 0) {
    onCellsTruncated?.(truncatedCellCount);
  }

  return workbookToBlob(workbook, { bookSST: true, compression: true });
}

function getTemplateCellText(worksheet: XLSX.WorkSheet, address: string): string | null {
  const value = (worksheet[address] as XLSX.CellObject | undefined)?.v;
  if (value == null) {
    return null;
  }
  return String(value).trim() || null;
}

/** SheetJS side of `openLoadMultiObjectTemplateWorkbook`. The whole workbook is parsed up front. */
export async function openLoadMultiObjectTemplateWorkbookLegacy(source: SourceInput): Promise<LoadMultiObjectTemplateWorkbook> {
  const workbook = await readWorkbook(source);
  const { cells, headerRow } = LOAD_MULTI_OBJECT_TEMPLATE_LAYOUT;

  return {
    sheetNames: workbook.SheetNames,
    async readSheet(sheetName: string): Promise<LoadMultiObjectTemplateSheet> {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        ...SHEET_TO_JSON_OPTIONS,
        // 0-based index of the row the column headers are on
        range: headerRow - 1,
        header: 1,
      });
      const columnHeaders = (rows[0] || []).map((header) => (header == null ? '' : String(header).trim()));

      return {
        sobject: getTemplateCellText(worksheet, cells.sobject),
        operation: getTemplateCellText(worksheet, cells.operation),
        externalId: getTemplateCellText(worksheet, cells.externalId),
        referenceIdHeader: getTemplateCellText(worksheet, cells.referenceIdHeader),
        columnHeaders,
        dataRows: rows.slice(1).map((row) => Array.from({ length: columnHeaders.length }, (_, index) => (row[index] ?? '') as CellValue)),
      };
    },
    close: () => Promise.resolve(),
  };
}
