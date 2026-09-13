import { DATE_FORMATS, MIME_TYPES } from '@jetstream/shared/constants';
import {
  collectToBlob,
  createWorkbookWriter,
  formatRange,
  getMaxWidthFromColumnContent,
  type CellInput,
  type ColumnOptions,
  type StyleId,
  type WorkbookWriter,
} from '@jetstream/shared/ui-utils';
import {
  Maybe,
  PermissionTableFieldCell,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
  PermissionTableSystemPermissionCell,
  PermissionTableTabVisibilityCell,
} from '@jetstream/types';
import { ColumnWithFilter } from '@jetstream/ui';
import { formatDate } from 'date-fns/format';
import { isValid as isDateValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import JSZip from 'jszip';
import { unparse } from 'papaparse';
import { FIELD_AUDIT_COLUMNS, getFieldAuditExportHeaders } from './permission-manager-field-audit-columns';

/**
 * Excel number format for the audit date cells. `hh` is 24 hour here because the format has no AM/PM token, which
 * keeps the worksheet rendering the same as `DATE_FORMATS.yyyy_MM_dd_HH_mm_ss` in the csv.
 */
const AUDIT_DATE_EXCEL_FORMAT = 'yyyy-mm-dd hh:mm:ss';

type PermissionExportColumn =
  | ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>;

/**
 * A sheet assembled in memory before it is streamed into the workbook.
 *
 * The writer has no worksheet object to decorate after the fact - rows, merges and column widths all have to be
 * known by the time the sheet is opened - so each `generate*Worksheet` returns this and `writeWorksheet` does the
 * writing for all four sheets.
 */
interface PermissionWorksheet {
  /** Written above the data in bold. Every sheet but System Permissions has two: the group header and its sub-columns */
  headerRows: CellInput[][];
  dataRows: CellInput[][];
  /** A1 ranges for the profile / permission set group headers */
  merges: string[];
  columns: ColumnOptions[];
  /** Column indexes of the data rows that hold a `Date`, so those cells get the audit date number format */
  dateColumnIndexes?: number[];
}

interface PermissionWorksheetStyles {
  headerStyle: StyleId;
  auditDateStyle: StyleId;
}

export interface GenerateExcelWorkbookOptions {
  /** Called once with the total number of cells that exceeded Excel's per-cell character limit and were truncated */
  onCellsTruncated?: (truncatedCellCount: number) => void;
}

/** Columns of the field permissions export that come before the audit columns */
const FIELD_EXPORT_LEAD_COLUMNS = ['Object', 'Field Api Name', 'Field Label'];

/**
 * Leading columns of the field permissions export, before the per profile / permission set groups.
 *
 * Audit columns are always exported even when hidden in the grid - a spreadsheet has no width pressure, and
 * they are most useful there.
 */
function getFieldExportPrefix(): string[] {
  return [...FIELD_EXPORT_LEAD_COLUMNS, ...getFieldAuditExportHeaders()];
}

/** Audit timestamps arrive as raw ISO strings from the Tooling API */
function parseAuditDate(value: Maybe<string>): Date | null {
  if (!value) {
    return null;
  }
  const parsedDate = parseISO(value);
  return isDateValid(parsedDate) ? parsedDate : null;
}

/**
 * Leading columns of a single field row.
 *
 * `formatAuditDate` decides how the date columns are emitted - the csv needs a sortable string while the worksheet
 * needs a real Date, which Excel turns into a native date cell instead of text that cannot be sorted or filtered
 * chronologically.
 */
function getFieldExportRowPrefix<TDateValue extends string | Date>(
  row: PermissionTableFieldCell,
  formatAuditDate: (date: Date) => TDateValue,
): (string | TDateValue)[] {
  return [
    row.sobject,
    row.apiName,
    row.label,
    // Derived from the same list as `getFieldAuditExportHeaders`, so values cannot drift out from under headers
    ...FIELD_AUDIT_COLUMNS.map(({ key, type }) => {
      const value = row[key] ?? '';
      if (type !== 'date') {
        return value;
      }
      const parsedDate = parseAuditDate(value);
      // Keep the raw value rather than dropping data if Salesforce ever returns an unparseable timestamp
      return parsedDate ? formatAuditDate(parsedDate) : value;
    }),
  ];
}

/** 24 hour and zero padded so the column sorts correctly even when a spreadsheet treats it as text */
function getFieldCsvRowPrefix(row: PermissionTableFieldCell): string[] {
  return getFieldExportRowPrefix(row, (date) => formatDate(date, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss));
}

function getFieldWorksheetRowPrefix(row: PermissionTableFieldCell): (string | Date)[] {
  return getFieldExportRowPrefix(row, (date) => date);
}

export async function generateExcelWorkbookFromTable(
  objectData: { columns: PermissionExportColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: PermissionExportColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: PermissionExportColumn[]; rows: PermissionTableFieldCell[] },
  systemPermissionData: { columns: PermissionExportColumn[]; rows: PermissionTableSystemPermissionCell[] },
  { onCellsTruncated }: GenerateExcelWorkbookOptions = {},
): Promise<Blob> {
  const sink = collectToBlob(MIME_TYPES.XLSX_OPEN_OFFICE);
  const workbook = createWorkbookWriter(sink, {
    cellOverflow: 'truncate',
    // Every permission cell is TRUE or FALSE and every object name repeats across sheets, so the bounded shared
    // string table is worth its memory here - this is what `bookSST: true` used to give us
    strings: 'auto',
  });
  const styles: PermissionWorksheetStyles = {
    headerStyle: workbook.registerStyle({ font: { bold: true } }),
    auditDateStyle: workbook.registerStyle({ numFmt: AUDIT_DATE_EXCEL_FORMAT }),
  };

  try {
    await writeWorksheet(workbook, 'Object Permissions', generateObjectWorksheet(objectData.columns, objectData.rows), styles);
    await writeWorksheet(
      workbook,
      'Tab Visibility',
      generateTabVisibilityWorksheet(tabVisibilityData.columns, tabVisibilityData.rows),
      styles,
    );
    await writeWorksheet(workbook, 'Field Permissions', generateFieldWorksheet(fieldData.columns, fieldData.rows), styles);
    await writeWorksheet(
      workbook,
      'System Permissions',
      generateSystemPermissionWorksheet(systemPermissionData.columns, systemPermissionData.rows),
      styles,
    );

    const { truncatedCells } = await workbook.close();
    if (truncatedCells > 0) {
      onCellsTruncated?.(truncatedCells);
    }
  } catch (ex) {
    await workbook.abort(ex);
    throw ex;
  }

  return sink.result();
}

/** Streams one prepared sheet into the workbook: the bold header rows, the merged group ranges, then the data */
async function writeWorksheet(
  workbook: WorkbookWriter,
  sheetName: string,
  { headerRows, dataRows, merges, columns, dateColumnIndexes }: PermissionWorksheet,
  { headerStyle, auditDateStyle }: PermissionWorksheetStyles,
): Promise<void> {
  // No `header` option - these sheets have two header rows, and it only writes one
  const sheet = workbook.addSheet(sheetName, { columns });
  for (const headerRow of headerRows) {
    await sheet.writeRow(headerRow, headerStyle);
  }
  merges.forEach((range) => sheet.merge(range));

  if (dateColumnIndexes?.length) {
    // One style id per cell, and every data row has the same shape, so the array is built once. Cells past the end
    // of it get the default style, which for a Date is already this same format code - this pins the intent.
    const dataRowStyles: (StyleId | undefined)[] = [];
    dateColumnIndexes.forEach((columnIndex) => {
      dataRowStyles[columnIndex] = auditDateStyle;
    });
    for (const dataRow of dataRows) {
      await sheet.writeRow(dataRow, dataRowStyles);
    }
  } else {
    await sheet.writeRows(dataRows);
  }

  await sheet.close();
}

/**
 * Column widths are measured from the text Excel will render, so a Date is measured as the audit date format
 * rather than as the full javascript date string.
 */
function getColumnWidths(rows: CellInput[][], skipRows: Set<number>): ColumnOptions[] {
  return getMaxWidthFromColumnContent(
    rows.map((row) => row.map((value) => (value instanceof Date ? formatDate(value, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss) : `${value ?? ''}`))),
    skipRows,
  );
}

export async function generateCsvFilesFromTable(
  objectData: { columns: PermissionExportColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: PermissionExportColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: PermissionExportColumn[]; rows: PermissionTableFieldCell[] },
  systemPermissionData: { columns: PermissionExportColumn[]; rows: PermissionTableSystemPermissionCell[] },
) {
  const objectCsv = generateObjectCsv(objectData.columns, objectData.rows);
  const tabVisibilityCsv = generateTabVisibilityCsv(tabVisibilityData.columns, tabVisibilityData.rows);
  const fieldCsv = generateFieldCsv(fieldData.columns, fieldData.rows);
  const systemPermissionCsv = generateSystemPermissionCsv(systemPermissionData.columns, systemPermissionData.rows);

  const csvExports = JSZip();

  csvExports.file('object-permissions.csv', objectCsv);
  csvExports.file('tab-visibility.csv', tabVisibilityCsv);
  csvExports.file('field-permissions.csv', fieldCsv);
  csvExports.file('system-permissions.csv', systemPermissionCsv);

  const zipFile = await csvExports.generateAsync({
    type: 'arraybuffer',
    compression: 'STORE',
    mimeType: 'application/zip',
    platform: 'UNIX',
  });

  return zipFile;
}

function generateObjectWorksheet(columns: PermissionExportColumn[], rows: PermissionTableObjectCell[]): PermissionWorksheet {
  const merges: string[] = [];
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const dataRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      // header 1 - the group name followed by 6 cells it is merged over
      header1.push(col.name as string, '', '', '', '', '', '');
      merges.push(formatRange(0, header1.length - 7, 0, header1.length - 1));
      // header 2
      header2.push('Read', 'Create', 'Edit', 'Delete', 'View All', 'Modify All', 'View All Fields');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(
        permission.read ? 'TRUE' : 'FALSE',
        permission.create ? 'TRUE' : 'FALSE',
        permission.edit ? 'TRUE' : 'FALSE',
        permission.delete ? 'TRUE' : 'FALSE',
        permission.viewAll ? 'TRUE' : 'FALSE',
        permission.modifyAll ? 'TRUE' : 'FALSE',
        permission.viewAllFields ? 'TRUE' : 'FALSE',
      );
    });
    dataRows.push(currRow);
  });

  const headerRows = [header1, header2];
  return { headerRows, dataRows, merges, columns: getColumnWidths([...headerRows, ...dataRows], new Set([0])) };
}

function generateFieldWorksheet(columns: PermissionExportColumn[], rows: PermissionTableFieldCell[]): PermissionWorksheet {
  const merges: string[] = [];
  const exportPrefix = getFieldExportPrefix();
  const header1: string[] = exportPrefix.map(() => '');
  const header2: string[] = [...exportPrefix];
  const dataRows: (string | Date)[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      if (col.colSpan) {
        // header 1 - the group name followed by the one cell it is merged over
        header1.push(col.name as string, '');
        merges.push(formatRange(0, header1.length - 2, 0, header1.length - 1));
        // header 2
        header2.push('Read', 'Edit');
        // keep track of group order to ensure same across all rows
        // key: `${id}-${actionKey}`,
        permissionKeys.push(col.key.split('-')[0]);
      }
    });

  rows.forEach((row) => {
    const currRow = getFieldWorksheetRowPrefix(row);
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE', permission.edit ? 'TRUE' : 'FALSE');
    });
    dataRows.push(currRow);
  });

  const headerRows = [header1, header2];
  return {
    headerRows,
    dataRows,
    merges,
    columns: getColumnWidths([...headerRows, ...dataRows], new Set([0])),
    dateColumnIndexes: getFieldAuditDateColumnIndexes(),
  };
}

/** Where the audit timestamps land in a field row, derived from the same list the headers and values come from */
function getFieldAuditDateColumnIndexes(): number[] {
  return FIELD_AUDIT_COLUMNS.reduce<number[]>((columnIndexes, { type }, index) => {
    if (type === 'date') {
      columnIndexes.push(FIELD_EXPORT_LEAD_COLUMNS.length + index);
    }
    return columnIndexes;
  }, []);
}

function generateTabVisibilityWorksheet(columns: PermissionExportColumn[], rows: PermissionTableTabVisibilityCell[]): PermissionWorksheet {
  const merges: string[] = [];
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const dataRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-available'))
    .forEach((col) => {
      // header 1 - the group name followed by the one cell it is merged over
      header1.push(col.name as string, '');
      merges.push(formatRange(0, header1.length - 2, 0, header1.length - 1));
      // header 2
      header2.push('Available', 'Visible');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.available ? 'TRUE' : 'FALSE', permission.visible ? 'TRUE' : 'FALSE');
    });
    dataRows.push(currRow);
  });

  const headerRows = [header1, header2];
  return { headerRows, dataRows, merges, columns: getColumnWidths([...headerRows, ...dataRows], new Set([0])) };
}

function generateObjectCsv(columns: PermissionExportColumn[], rows: PermissionTableObjectCell[]) {
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      // header 1 - merged field with 6 blank columns following
      header1.push(col.name as string, '', '', '', '', '', '');
      // header 2
      header2.push('Read', 'Create', 'Edit', 'Delete', 'View All', 'Modify All', 'View All Fields');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(
        permission.read ? 'TRUE' : 'FALSE',
        permission.create ? 'TRUE' : 'FALSE',
        permission.edit ? 'TRUE' : 'FALSE',
        permission.delete ? 'TRUE' : 'FALSE',
        permission.viewAll ? 'TRUE' : 'FALSE',
        permission.modifyAll ? 'TRUE' : 'FALSE',
        permission.viewAllFields ? 'TRUE' : 'FALSE',
      );
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

export function generateFieldCsv(columns: PermissionExportColumn[], rows: PermissionTableFieldCell[]) {
  const exportPrefix = getFieldExportPrefix();
  const header1: string[] = exportPrefix.map(() => '');
  const header2: string[] = [...exportPrefix];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      if (col.colSpan) {
        // header 1 - merged field with 1 blank column following
        header1.push(col.name as string, '');
        // header 2
        header2.push('Read', 'Edit');
        // keep track of group order to ensure same across all rows
        permissionKeys.push(col.key.split('-')[0]);
      }
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = getFieldCsvRowPrefix(row);
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE', permission.edit ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

function generateTabVisibilityCsv(columns: PermissionExportColumn[], rows: PermissionTableTabVisibilityCell[]) {
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-available'))
    .forEach((col) => {
      // header 1 - merged field with 1 blank column following
      header1.push(col.name as string, '');
      // header 2
      header2.push('Available', 'Visible');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.available ? 'TRUE' : 'FALSE', permission.visible ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

// System permissions have a single value per profile/permission set, so each column maps to one
// header cell (no merged sub-columns like the object/field/tab sheets).
function generateSystemPermissionWorksheet(
  columns: PermissionExportColumn[],
  rows: PermissionTableSystemPermissionCell[],
): PermissionWorksheet {
  const header: string[] = ['System Permission', 'API Name'];
  const dataRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-enabled'))
    .forEach((col) => {
      header.push(col.name as string);
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row) => {
    const currRow = [row.label, row.apiName];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.enabled ? 'TRUE' : 'FALSE');
    });
    dataRows.push(currRow);
  });

  const headerRows = [header];
  return { headerRows, dataRows, merges: [], columns: getColumnWidths([...headerRows, ...dataRows], new Set([0, 1])) };
}

function generateSystemPermissionCsv(columns: PermissionExportColumn[], rows: PermissionTableSystemPermissionCell[]) {
  const header: string[] = ['System Permission', 'API Name'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-enabled'))
    .forEach((col) => {
      header.push(col.name as string);
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header);

  rows.forEach((row) => {
    const currRow = [row.label, row.apiName];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.enabled ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}
